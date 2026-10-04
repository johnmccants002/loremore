import ExpoModulesCore

public class LoreMoreShareModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LoreMoreShare")
    Function("setOwner") { (userId: String?) in try ShareInbox().setOwner(userId) }
    AsyncFunction("list") { (userId: String) -> [[String: Any]] in
      let inbox = try ShareInbox()
      return try inbox.list(userId: userId).map { item in
        var value: [String: Any] = ["id": item.id, "userId": item.userId, "capturedAt": item.capturedAt,
          "width": item.width, "height": item.height, "sizeBytes": item.sizeBytes,
          "uri": try inbox.imageURL(userId: userId, id: item.id).absoluteString]
        if let timestamp = item.sourceTimestamp { value["sourceTimestamp"] = timestamp }
        return value
      }
    }
    AsyncFunction("acknowledge") { (userId: String, id: String) in try ShareInbox().acknowledge(userId: userId, id: id) }
  }
}
