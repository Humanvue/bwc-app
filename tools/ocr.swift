// OCR a scanned PDF with Apple's Vision framework and print the text, page by page.
// Usage: swift ocr.swift <input.pdf>
import Foundation
import PDFKit
import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
    FileHandle.standardError.write("cannot open \(path)\n".data(using: .utf8)!)
    exit(1)
}

for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 3.0  // ~216 dpi, enough for typed memos
    let size = NSSize(width: bounds.width * scale, height: bounds.height * scale)
    let image = page.thumbnail(of: size, for: .mediaBox)
    guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])

    print("===== Page \(i + 1) =====")
    for obs in request.results ?? [] {
        if let best = obs.topCandidates(1).first { print(best.string) }
    }
}
