import Foundation
import Darwin

struct SharedPhoto: Codable {
  let id: String
  let userId: String
  let capturedAt: String
  let width: Int
  let height: Int
  let sizeBytes: Int
  let sourceTimestamp: String?
}

enum ShareInboxError: LocalizedError {
  case unavailable, signIn, invalid, full
  var errorDescription: String? {
    switch self {
    case .unavailable: return "The shared inbox is unavailable. Open LoreMore and try again."
    case .signIn: return "Open LoreMore and sign in before sharing a photo."
    case .invalid: return "This photo could not be saved. Please share it again."
    case .full: return "Your shared inbox is full. Open LoreMore to sync your photos first."
    }
  }
}

// Shared by the extension and the Expo module. All access uses a cross-process
// lock; a staged directory is renamed only after both image and manifest exist.
final class ShareInbox {
  let root: URL
  private let fm = FileManager.default
  static let maxPhotoBytes = 12 * 1024 * 1024

  convenience init() throws {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "LoreMoreAppGroup") as? String,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { throw ShareInboxError.unavailable }
    try self.init(root: container.appendingPathComponent("LoreMoreInbox", isDirectory: true))
  }

  init(root: URL) throws {
    self.root = root
    try fm.createDirectory(at: root, withIntermediateDirectories: true)
    var protectedRoot = root
    var values = URLResourceValues(); values.isExcludedFromBackup = true
    try protectedRoot.setResourceValues(values)
    #if os(iOS)
    try fm.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: root.path)
    #endif
  }

  private func locked<T>(_ action: () throws -> T) throws -> T {
    let fd = open(root.appendingPathComponent(".lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard fd >= 0 else { throw ShareInboxError.unavailable }
    defer { close(fd) }
    guard flock(fd, LOCK_EX) == 0 else { throw ShareInboxError.unavailable }
    defer { flock(fd, LOCK_UN) }
    return try action()
  }

  private func canonical(_ value: String) throws -> String {
    guard let id = UUID(uuidString: value) else { throw ShareInboxError.invalid }
    return id.uuidString.lowercased()
  }

  private func ownerUnlocked() throws -> String {
    guard let value = try? String(contentsOf: root.appendingPathComponent("owner"), encoding: .utf8),
      let owner = try? canonical(value) else { throw ShareInboxError.signIn }
    return owner
  }

  func owner() throws -> String { try locked { try ownerUnlocked() } }

  func setOwner(_ userId: String?) throws {
    try locked {
      let url = root.appendingPathComponent("owner")
      if let userId = userId {
        try canonical(userId).write(to: url, atomically: true, encoding: .utf8)
      } else if fm.fileExists(atPath: url.path) { try fm.removeItem(at: url) }
    }
  }

  func enqueue(jpeg: Data, width: Int, height: Int, userId: String, sourceTimestamp: String?) throws -> SharedPhoto {
    try locked {
      let owner = try canonical(userId)
      guard try ownerUnlocked() == owner else { throw ShareInboxError.signIn }
      guard !jpeg.isEmpty, jpeg.count <= Self.maxPhotoBytes, width > 0, height > 0 else { throw ShareInboxError.invalid }
      let folder = root.appendingPathComponent(owner, isDirectory: true)
      try fm.createDirectory(at: folder, withIntermediateDirectories: true)
      let entries = try fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
      // Remove staging directories left by an extension killed before commit.
      for entry in entries where entry.lastPathComponent.hasPrefix(".staging-") { try? fm.removeItem(at: entry) }
      guard entries.filter({ UUID(uuidString: $0.lastPathComponent) != nil }).count < 50 else { throw ShareInboxError.full }
      let id = UUID().uuidString.lowercased()
      let date = ISO8601DateFormatter(); date.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      let item = SharedPhoto(id: id, userId: owner, capturedAt: date.string(from: Date()), width: width,
        height: height, sizeBytes: jpeg.count, sourceTimestamp: sourceTimestamp.map { String($0.prefix(100)) })
      let staging = folder.appendingPathComponent(".staging-" + id, isDirectory: true)
      try fm.createDirectory(at: staging, withIntermediateDirectories: false)
      defer { try? fm.removeItem(at: staging) }
      #if os(iOS)
      try fm.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: staging.path)
      #endif
      try jpeg.write(to: staging.appendingPathComponent("image.jpg"), options: .atomic)
      try JSONEncoder().encode(item).write(to: staging.appendingPathComponent("record.json"), options: .atomic)
      #if os(iOS)
      for name in ["image.jpg", "record.json"] {
        try fm.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: staging.appendingPathComponent(name).path)
      }
      #endif
      try fm.moveItem(at: staging, to: folder.appendingPathComponent(id, isDirectory: true))
      return item
    }
  }

  func list(userId: String) throws -> [SharedPhoto] {
    try locked {
      let owner = try canonical(userId)
      let folder = root.appendingPathComponent(owner, isDirectory: true)
      guard fm.fileExists(atPath: folder.path) else { return [] }
      return try fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
        .filter { UUID(uuidString: $0.lastPathComponent) != nil }
        .map { url in
          let item = try JSONDecoder().decode(SharedPhoto.self, from: Data(contentsOf: url.appendingPathComponent("record.json")))
          let size = try fm.attributesOfItem(atPath: url.appendingPathComponent("image.jpg").path)[.size] as? NSNumber
          guard item.userId == owner, item.id == url.lastPathComponent, item.width > 0, item.height > 0,
            item.sizeBytes > 0, item.sizeBytes <= Self.maxPhotoBytes, size?.intValue == item.sizeBytes else { throw ShareInboxError.invalid }
          return item
        }.sorted { $0.capturedAt == $1.capturedAt ? $0.id < $1.id : $0.capturedAt < $1.capturedAt }
    }
  }

  func imageURL(userId: String, id: String) throws -> URL {
    root.appendingPathComponent(try canonical(userId)).appendingPathComponent(try canonical(id)).appendingPathComponent("image.jpg")
  }

  func acknowledge(userId: String, id: String) throws {
    try locked {
      let folder = try imageURL(userId: userId, id: id).deletingLastPathComponent()
      if fm.fileExists(atPath: folder.path) { try fm.removeItem(at: folder) }
    }
  }
}
