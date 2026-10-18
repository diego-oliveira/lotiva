import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("usage: ocr_image.swift image_path\n", stderr)
    exit(2)
}

let url = URL(fileURLWithPath: args[1])

let request = VNRecognizeTextRequest { request, error in
    if let error = error {
        fputs("ocr error: \(error)\n", stderr)
        exit(1)
    }
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        return
    }
    for obs in observations {
        guard let top = obs.topCandidates(1).first else { continue }
        let box = obs.boundingBox
        let line = [
            String(format: "%.6f", box.minX),
            String(format: "%.6f", box.minY),
            String(format: "%.6f", box.width),
            String(format: "%.6f", box.height),
            String(format: "%.3f", top.confidence),
            top.string.replacingOccurrences(of: "\t", with: " ")
        ].joined(separator: "\t")
        print(line)
    }
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.minimumTextHeight = 0.003

let handler = VNImageRequestHandler(url: url, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("perform error: \(error)\n", stderr)
    exit(1)
}
