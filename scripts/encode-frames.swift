// Encodes a folder of numbered JPEG frames (scripts/record-story-video.mjs)
// into an H.264 MP4 with AVFoundation (macOS's own encoder; no ffmpeg),
// laid out to start playing before it has all loaded. With a WAV
// (scripts/record-story-audio.mjs), it is the sound track, in AAC, cut to
// the frames' length.
//   swift scripts/encode-frames.swift <frames dir> <out.mp4> [fps] [Mbit/s] [sound.wav]
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
  print("usage: swift encode-frames.swift <frames dir> <out.mp4> [fps] [Mbit/s] [sound.wav]")
  exit(1)
}
let dir = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[2])
let fps = Int32(args.count > 3 ? Int(args[3]) ?? 30 : 30)
let mbps = args.count > 4 ? Double(args[4]) ?? 3 : 3
let wav = args.count > 5 ? URL(fileURLWithPath: args[5]) : nil

let frames = try FileManager.default.contentsOfDirectory(atPath: dir.path)
  .filter { $0.hasSuffix(".jpg") }.sorted()
guard let first = NSImage(contentsOf: dir.appendingPathComponent(frames[0])),
  let firstCG = first.cgImage(forProposedRect: nil, context: nil, hints: nil)
else { print("no frames"); exit(1) }
let width = firstCG.width, height = firstCG.height
let length = CMTime(value: CMTimeValue(frames.count), timescale: fps)

try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: Int(mbps * 1_000_000),
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
  ],
])
video.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height,
])
writer.add(video)

// The sound: read as 16-bit PCM, written as AAC.
var sound: AVAssetWriterInput?
var reader: AVAssetReader?
var samples: AVAssetReaderTrackOutput?
if let wav {
  let asset = AVURLAsset(url: wav)
  guard let track = asset.tracks(withMediaType: .audio).first else { print("no sound in \(wav.path)"); exit(1) }
  let r = try AVAssetReader(asset: asset)
  let o = AVAssetReaderTrackOutput(track: track, outputSettings: [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false,
    AVLinearPCMIsNonInterleaved: false,
  ])
  r.add(o)
  let s = AVAssetWriterInput(mediaType: .audio, outputSettings: [
    AVFormatIDKey: kAudioFormatMPEG4AAC,
    AVSampleRateKey: 48000,
    AVNumberOfChannelsKey: 2,
    AVEncoderBitRateKey: 160_000,
  ])
  s.expectsMediaDataInRealTime = false
  writer.add(s)
  sound = s
  reader = r
  samples = o
}

writer.startWriting()
writer.startSession(atSourceTime: .zero)
reader?.startReading()
let group = DispatchGroup()

group.enter()
var next = 0
var videoDone = false
video.requestMediaDataWhenReady(on: DispatchQueue(label: "video")) {
  while video.isReadyForMoreMediaData && !videoDone {
    if next >= frames.count {
      videoDone = true
      video.markAsFinished()
      group.leave()
      return
    }
    autoreleasepool {
      guard let image = NSImage(contentsOf: dir.appendingPathComponent(frames[next])),
        let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
      else { return }
      var buffer: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
      guard let pb = buffer else { return }
      CVPixelBufferLockBaseAddress(pb, [])
      let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(pb), width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)
      ctx?.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
      CVPixelBufferUnlockBaseAddress(pb, [])
      adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(next), timescale: fps))
    }
    next += 1
  }
}

if let sound, let samples {
  group.enter()
  var soundDone = false
  sound.requestMediaDataWhenReady(on: DispatchQueue(label: "sound")) {
    while sound.isReadyForMoreMediaData && !soundDone {
      if let buffer = samples.copyNextSampleBuffer(),
        CMSampleBufferGetPresentationTimeStamp(buffer) < length
      {
        sound.append(buffer)
      } else {
        soundDone = true
        sound.markAsFinished()
        group.leave()
        return
      }
    }
  }
}

group.wait()
writer.endSession(atSourceTime: length)
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status == .completed {
  let size = (try? FileManager.default.attributesOfItem(atPath: out.path)[.size] as? Int) ?? 0
  print("wrote \(out.path): \(frames.count) frames, \(width)x\(height)\(wav == nil ? "" : ", with sound"), \(String(format: "%.1f", Double(size) / 1e6)) MB")
} else {
  print("failed: \(String(describing: writer.error))")
  exit(1)
}
