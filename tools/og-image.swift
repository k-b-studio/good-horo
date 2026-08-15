// Renders the 1200x630 Open Graph card for /good-horoscope.
//
// CoreText is used rather than PIL because Thai needs complex-script shaping: tone
// marks and upper vowels stack above the base glyph, and a renderer without shaping
// places them beside it instead. The project's real faces (Prompt, IBM Plex Sans
// Thai) are registered from TTF, since Fontsource ships woff2 which CoreText cannot
// load.

import AppKit
import CoreText
import Foundation

let W = 1200.0
let H = 630.0

let args = CommandLine.arguments
guard args.count >= 3 else {
	FileHandle.standardError.write("usage: og.swift <fontDir> <outPath>\n".data(using: .utf8)!)
	exit(2)
}
let fontDir = URL(fileURLWithPath: args[1])
let outPath = URL(fileURLWithPath: args[2])

for name in ["Prompt-Bold.ttf", "Prompt-SemiBold.ttf", "IBMPlexSansThai-Regular.ttf"] {
	let url = fontDir.appendingPathComponent(name)
	var err: Unmanaged<CFError>?
	if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &err) {
		FileHandle.standardError.write("warn: could not register \(name)\n".data(using: .utf8)!)
	}
}

func font(_ name: String, _ size: CGFloat) -> CTFont {
	CTFontCreateWithName(name as CFString, size, nil)
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard
	let ctx = CGContext(
		data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0,
		space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { exit(1) }

func rgb(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> CGColor {
	CGColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a)
}

// Near-black with a warm ember wash. Deliberately ambiguous: the card should read as
// "fortune teller", not give away that half the app is HELL mode.
let bg = CGGradient(
	colorsSpace: colorSpace,
	colors: [rgb(28, 18, 16), rgb(10, 7, 6)] as CFArray,
	locations: [0, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 0, y: H), end: CGPoint(x: 0, y: 0), options: [])

let glow = CGGradient(
	colorsSpace: colorSpace,
	colors: [rgb(226, 130, 40, 0.42), rgb(226, 130, 40, 0)] as CFArray,
	locations: [0, 1])!
ctx.drawRadialGradient(
	glow, startCenter: CGPoint(x: W * 0.5, y: H * 0.86), startRadius: 0,
	endCenter: CGPoint(x: W * 0.5, y: H * 0.86), endRadius: 660, options: [])

/// Draws a single line, horizontally centred on `cx`, shrinking to fit `maxWidth`.
@discardableResult
func draw(
	_ text: String, _ fontName: String, _ size: CGFloat, _ color: CGColor,
	cx: CGFloat, y: CGFloat, maxWidth: CGFloat, tracking: CGFloat = 0
) -> CGFloat {
	var s = size
	var line: CTLine
	var width: Double

	repeat {
		let attrs: [NSAttributedString.Key: Any] = [
			.font: font(fontName, s),
			.foregroundColor: color,
			.kern: tracking,
		]
		line = CTLineCreateWithAttributedString(
			NSAttributedString(string: text, attributes: attrs))
		width = CTLineGetTypographicBounds(line, nil, nil, nil)
		if width <= maxWidth { break }
		s -= 2
	} while s > 12

	ctx.textPosition = CGPoint(x: cx - CGFloat(width) / 2, y: y)
	CTLineDraw(line, ctx)
	return CGFloat(width)
}

// Five face-down cards — the choice the app pretends to offer.
let cardW = 78.0
let cardH = 112.0
let gap = 22.0
let totalW = cardW * 5 + gap * 4
var cardX = (W - totalW) / 2
for i in 0..<5 {
	let angle = (Double(i) - 2) * 0.055
	ctx.saveGState()
	ctx.translateBy(x: cardX + cardW / 2, y: H - 176 + abs(Double(i) - 2) * -6)
	ctx.rotate(by: angle)
	let r = CGRect(x: -cardW / 2, y: -cardH / 2, width: cardW, height: cardH)
	let path = CGPath(roundedRect: r, cornerWidth: 10, cornerHeight: 10, transform: nil)
	ctx.addPath(path)
	ctx.setFillColor(rgb(38, 24, 20))
	ctx.fillPath()
	ctx.addPath(path)
	ctx.setStrokeColor(rgb(201, 154, 63, 0.55))
	ctx.setLineWidth(2)
	ctx.strokePath()
	ctx.restoreGState()
	cardX += cardW + gap
}

draw(
	"ดูดวงเข้าข้าง", "Prompt-Bold", 96, rgb(244, 226, 198),
	cx: W / 2, y: 286, maxWidth: W - 140)

draw(
	"หมอดูที่อยู่ข้างคุณเสมอ", "IBMPlexSansThai", 38, rgb(178, 150, 122),
	cx: W / 2, y: 218, maxWidth: W - 200)

draw(
	"kbstudio.space/good-horoscope", "Prompt-SemiBold", 27, rgb(226, 138, 60),
	cx: W / 2, y: 96, maxWidth: W - 200, tracking: 1.2)

guard let image = ctx.makeImage() else { exit(1) }
let rep = NSBitmapImageRep(cgImage: image)
guard let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
try png.write(to: outPath)
print("wrote \(outPath.path)")
