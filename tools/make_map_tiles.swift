// Render the georeferenced map frame of a GeoPDF into a zoomable tile pyramid for the web.
// Usage: swift tools/make_map_tiles.swift <map.pdf> <out-dir> <x0> <y0> <x1> <y1> [scale]
//   x0 y0 x1 y1: the map frame (the GeoPDF /VP BBox) in PDF points, origin bottom-left.
//   scale: pixels per PDF point at the most zoomed-in level (default 2).
// Writes <out-dir>/<z>/<x>/<y>.jpg (Leaflet layout, 256 px tiles) and <out-dir>/size.json.
import Foundation
import PDFKit
import AppKit

let a = CommandLine.arguments
guard a.count >= 7, let doc = PDFDocument(url: URL(fileURLWithPath: a[1])), let page = doc.page(at: 0) else {
    FileHandle.standardError.write("usage: make_map_tiles.swift map.pdf out x0 y0 x1 y1 [scale]\n".data(using: .utf8)!)
    exit(1)
}
let out = URL(fileURLWithPath: a[2])
let x0 = CGFloat(Double(a[3])!), y0 = CGFloat(Double(a[4])!), x1 = CGFloat(Double(a[5])!), y1 = CGFloat(Double(a[6])!)
let scale = a.count > 7 ? CGFloat(Double(a[7])!) : 2
let W = Int((x1 - x0) * scale), H = Int((y1 - y0) * scale)
let tile = 256

// Render the frame once at full resolution.
let space = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { exit(2) }
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
ctx.scaleBy(x: scale, y: scale)
ctx.translateBy(x: -x0, y: -y0)
page.draw(with: .mediaBox, to: ctx)
guard let full = ctx.makeImage() else { exit(3) }
print("rendered \(W)x\(H)")

func jpeg(_ img: CGImage, _ url: URL) {
    let rep = NSBitmapImageRep(cgImage: img)
    let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.72])!
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try? data.write(to: url)
}

// Zoom levels: zmax is native; each level below halves the size.
var zmax = 0
while (1 << zmax) * tile < max(W, H) { zmax += 1 }
var count = 0
for z in stride(from: zmax, through: 0, by: -1) {
    let f = CGFloat(1 << (zmax - z))          // native pixels per level pixel
    let lw = Int(ceil(CGFloat(W) / f)), lh = Int(ceil(CGFloat(H) / f))
    let cols = Int(ceil(Double(lw) / Double(tile))), rows = Int(ceil(Double(lh) / Double(tile)))
    for tx in 0..<cols {
        for ty in 0..<rows {
            // Source rectangle in native pixels (CGImage origin is top-left).
            let src = CGRect(x: CGFloat(tx * tile) * f, y: CGFloat(ty * tile) * f, width: CGFloat(tile) * f, height: CGFloat(tile) * f)
                .intersection(CGRect(x: 0, y: 0, width: W, height: H))
            guard !src.isEmpty, let part = full.cropping(to: src) else { continue }
            guard let t = CGContext(data: nil, width: tile, height: tile, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }
            t.setFillColor(CGColor(red: 0.85, green: 0.85, blue: 0.85, alpha: 1))
            t.fill(CGRect(x: 0, y: 0, width: tile, height: tile))
            t.interpolationQuality = .high
            let dw = src.width / f, dh = src.height / f
            t.draw(part, in: CGRect(x: 0, y: CGFloat(tile) - dh, width: dw, height: dh))
            if let img = t.makeImage() {
                jpeg(img, out.appendingPathComponent("\(z)/\(tx)/\(ty).jpg"))
                count += 1
            }
        }
    }
}
let meta = "{\"width\": \(W), \"height\": \(H), \"zmax\": \(zmax), \"tile\": \(tile), \"scale\": \(scale)}\n"
try? meta.write(to: out.appendingPathComponent("size.json"), atomically: true, encoding: .utf8)
print("wrote \(count) tiles, zmax \(zmax)")
