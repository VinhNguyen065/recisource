import UIKit
import UniformTypeIdentifiers

// 21again share sheet target. Receives a link (or text containing one) from Safari,
// Facebook, TikTok, YouTube, Instagram, Notes … and hands it to the main app through
// the twentyone:// URL scheme, where the recipe import starts automatically.
class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.clear
        handleShare()
    }

    private func handleShare() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { finish(nil); return }
        let providers = items.flatMap { $0.attachments ?? [] }
        let group = DispatchGroup()
        var found: String? = nil
        let lock = NSLock()
        func keep(_ s: String?) { guard let s = s, !s.isEmpty else { return }; lock.lock(); if found == nil { found = s }; lock.unlock() }
        for p in providers {
            if p.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                p.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, _ in
                    if let u = data as? URL { keep(u.absoluteString) }
                    else if let d = data as? Data, let s = String(data: d, encoding: .utf8) { keep(s) }
                    group.leave()
                }
            } else if p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                p.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { data, _ in
                    if let s = data as? String { keep(ShareViewController.firstURL(in: s) ?? s) }
                    else if let d = data as? Data, let s = String(data: d, encoding: .utf8) { keep(ShareViewController.firstURL(in: s) ?? s) }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { [weak self] in self?.finish(found) }
    }

    private static func firstURL(in s: String) -> String? {
        guard let det = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return nil }
        let range = NSRange(s.startIndex..<s.endIndex, in: s)
        return det.firstMatch(in: s, options: [], range: range)?.url?.absoluteString
    }

    private func finish(_ shared: String?) {
        if let s = shared,
           let enc = s.addingPercentEncoding(withAllowedCharacters: CharacterSet.alphanumerics),
           let url = URL(string: "twentyone://import?u=" + enc) {
            openHostApp(url)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    // A share extension cannot use UIApplication.shared. Walk the responder chain to the
    // host process object that implements openURL: — the approach used by the common
    // React Native / Flutter share-menu plugins.
    private func openHostApp(_ url: URL) {
        let sel = NSSelectorFromString("openURL:")
        var responder: UIResponder? = self
        while let r = responder {
            if r.responds(to: sel) {
                r.perform(sel, with: url)
                return
            }
            responder = r.next
        }
        extensionContext?.open(url, completionHandler: nil)
    }
}
