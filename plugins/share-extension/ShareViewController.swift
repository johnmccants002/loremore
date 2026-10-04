import UIKit
import UniformTypeIdentifiers
import ImageIO

final class ShareViewController: UIViewController {
  private let titleLabel = UILabel()
  private let messageLabel = UILabel()
  private let spinner = UIActivityIndicatorView(style: .large)
  private let done = UIButton(type: .system)
  private var finished = false
  private var progress: Progress?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.97, green: 0.96, blue: 0.93, alpha: 1)
    titleLabel.font = .preferredFont(forTextStyle: .title1)
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.numberOfLines = 0; titleLabel.textAlignment = .center
    titleLabel.accessibilityTraits = .header
    messageLabel.font = .preferredFont(forTextStyle: .body)
    messageLabel.adjustsFontForContentSizeCategory = true
    messageLabel.numberOfLines = 0; messageLabel.textAlignment = .center
    titleLabel.text = "Adding your photo…"
    messageLabel.text = "Saving a private copy for your journal."
    done.setTitle("Cancel", for: .normal)
    done.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    done.addTarget(self, action: #selector(close), for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [spinner, titleLabel, messageLabel, done])
    stack.axis = .vertical; stack.spacing = 24; stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 28),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -28),
      stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
      done.heightAnchor.constraint(greaterThanOrEqualToConstant: 48)
    ])
    spinner.startAnimating()
    receivePhoto()
  }

  private func receivePhoto() {
    do {
      let inbox = try ShareInbox()
      let owner = try inbox.owner()
      let attachments = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
      let images = attachments.filter { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }
      guard images.count == 1, let provider = images.first else { throw ShareInboxError.invalid }
      // Decode inside the provider callback: its temporary URL expires on return.
      progress = provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] url, error in
        do {
          guard error == nil, let url = url else { throw ShareInboxError.invalid }
          let values = try url.resourceValues(forKeys: [.fileSizeKey])
          guard let size = values.fileSize, size > 0, size <= 50 * 1024 * 1024,
            let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
            let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
              kCGImageSourceCreateThumbnailFromImageAlways: true,
              kCGImageSourceCreateThumbnailWithTransform: true,
              kCGImageSourceThumbnailMaxPixelSize: 2048,
              kCGImageSourceShouldCacheImmediately: true
            ] as CFDictionary) else { throw ShareInboxError.invalid }
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
          let exif = properties?[kCGImagePropertyExifDictionary] as? [CFString: Any]
          let timestamp = exif?[kCGImagePropertyExifDateTimeOriginal] as? String
          let output = NSMutableData()
          guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { throw ShareInboxError.invalid }
          CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
          guard CGImageDestinationFinalize(destination) else { throw ShareInboxError.invalid }
          let jpeg = output as Data
          DispatchQueue.main.async {
            guard let self = self, !self.finished else { return }
            do {
              _ = try inbox.enqueue(jpeg: jpeg, width: image.width, height: image.height, userId: owner, sourceTimestamp: timestamp)
              self.show(title: "Added to LoreMore", message: "Saved on this device. Open LoreMore to finish syncing it to your journal.")
            } catch { self.showError(error) }
          }
        } catch {
          DispatchQueue.main.async { guard let self = self, !self.finished else { return }; self.showError(error) }
        }
      }
    } catch { showError(error) }
  }

  private func showError(_ error: Error) {
    show(title: "Couldn’t add this photo", message: (error as? ShareInboxError)?.errorDescription ?? "Please try again with a photo smaller than 50 MB. No photo was added.")
  }
  private func show(title: String, message: String) {
    finished = true; spinner.stopAnimating(); spinner.isHidden = true
    titleLabel.text = title; messageLabel.text = message; done.setTitle("Done", for: .normal)
    UIAccessibility.post(notification: .announcement, argument: title + ". " + message)
  }
  @objc private func close() {
    finished = true; progress?.cancel()
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
