import Foundation

func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
  if try !condition() { fatalError(message) }
}
func rejects(_ action: () throws -> Void, _ message: String) {
  do { try action(); fatalError(message) } catch {}
}
let root = FileManager.default.temporaryDirectory.appendingPathComponent("LoreMoreInboxTest-" + UUID().uuidString)
defer { try? FileManager.default.removeItem(at: root) }
let alice = UUID().uuidString.lowercased(), bob = UUID().uuidString.lowercased()
let inbox = try ShareInbox(root: root)
rejects({ _ = try inbox.owner() }, "Signed-out capture must fail")
try inbox.setOwner(alice)
let photo = try inbox.enqueue(jpeg: Data([1, 2, 3]), width: 2, height: 3, userId: alice, sourceTimestamp: "2020:01:02 03:04:05")
let reopened = try ShareInbox(root: root)
try check(try reopened.list(userId: alice).map(\.id) == [photo.id], "Queue survives process recreation")
try check(try reopened.list(userId: bob).isEmpty, "Queue must be isolated by account")
try check(try Data(contentsOf: reopened.imageURL(userId: alice, id: photo.id)) == Data([1, 2, 3]), "Bytes persist")
try check(try reopened.list(userId: alice)[0].sourceTimestamp == "2020:01:02 03:04:05", "Source timestamp persists")
try inbox.setOwner(bob)
rejects({ _ = try inbox.enqueue(jpeg: Data([1]), width: 1, height: 1, userId: alice, sourceTimestamp: nil) }, "Owner changed during capture")
rejects({ _ = try inbox.imageURL(userId: "../", id: photo.id) }, "Reject path traversal")
rejects({ _ = try inbox.enqueue(jpeg: Data(), width: 1, height: 1, userId: bob, sourceTimestamp: nil) }, "Reject empty image")
try inbox.setOwner(nil)
rejects({ _ = try inbox.owner() }, "Sign out clears extension capture")
try check(try inbox.list(userId: alice).count == 1, "Signing out preserves the original owner's queued photo")
try inbox.acknowledge(userId: bob, id: photo.id)
try check(try inbox.list(userId: alice).count == 1, "Another account cannot acknowledge a photo")
try inbox.acknowledge(userId: alice, id: photo.id)
try inbox.acknowledge(userId: alice, id: photo.id)
try check(try inbox.list(userId: alice).isEmpty, "Acknowledgement is idempotent")
print("Native inbox persistence, ownership, validation, and acknowledgement tests passed.")
