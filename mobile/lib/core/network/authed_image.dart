import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import 'package:zolofund/core/network/dio_client.dart';

/// [ImageProvider] that fetches through the shared Dio client so the
/// Authorization / tenant headers (and the 401 refresh flow) apply to image
/// requests. Plain [NetworkImage] cannot load `/api/files/...` — the route
/// requires auth, so even an absolutized URL comes back 401 without the
/// Bearer token.
class AuthedImageProvider extends ImageProvider<AuthedImageProvider> {
  AuthedImageProvider(this.url, this._dio, {this.scale = 1.0});

  /// Absolute URL — resolve relative server paths with [absoluteMediaUrl]
  /// before constructing (the [authedImage] helper does this for you).
  final String url;
  final Dio _dio;
  final double scale;

  @override
  Future<AuthedImageProvider> obtainKey(ImageConfiguration configuration) =>
      SynchronousFuture<AuthedImageProvider>(this);

  @override
  ImageStreamCompleter loadImage(
    AuthedImageProvider key,
    ImageDecoderCallback decode,
  ) {
    return MultiFrameImageStreamCompleter(
      codec: _load(key, decode),
      scale: key.scale,
      debugLabel: key.url,
    );
  }

  // Uploaded files have unique generated names and never change, so cached
  // bytes stay valid forever — no expiry needed.
  static Directory? _diskCacheDir;

  static Future<File?> _diskCacheFileFor(String url) async {
    try {
      var dir = _diskCacheDir;
      if (dir == null) {
        final tmp = await getTemporaryDirectory();
        dir = Directory('${tmp.path}/authed_images');
        await dir.create(recursive: true);
        _diskCacheDir = dir;
      }
      final name = sha1.convert(utf8.encode(url)).toString();
      return File('${dir.path}/$name');
    } catch (_) {
      return null; // cache unavailable — fall back to network only
    }
  }

  Future<ui.Codec> _load(
    AuthedImageProvider key,
    ImageDecoderCallback decode,
  ) async {
    Uint8List? bytes;
    final cacheFile = await _diskCacheFileFor(key.url);
    if (cacheFile != null) {
      try {
        if (await cacheFile.exists()) {
          bytes = await cacheFile.readAsBytes();
          if (bytes.isEmpty) bytes = null;
        }
      } catch (_) {
        bytes = null;
      }
    }
    if (bytes == null) {
      final res = await _dio.get<List<int>>(
        key.url,
        options: Options(responseType: ResponseType.bytes),
      );
      final status = res.statusCode ?? 0;
      final data = res.data;
      if (status != 200 || data == null || data.isEmpty) {
        throw Exception('Image request failed ($status): ${key.url}');
      }
      bytes = Uint8List.fromList(data);
      if (cacheFile != null) {
        try {
          await cacheFile.writeAsBytes(bytes);
        } catch (_) {
          // best-effort cache write
        }
      }
    }
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    // Cap the decoded bitmap at 800px on the longest side. Uploaded photos are
    // 1200-1600px+; decoding them full-size costs 8-16 MB of RAM *each* while
    // they render as 24-64px avatars in lists — dozens of them at once is what
    // OOM-killed the app. 800px stays sharper than any layout slot we render
    // into while bounding each decode to ≤ ~2.5 MB.
    return decode(buffer, getTargetSize: (int intrinsicW, int intrinsicH) {
      const maxDim = 800;
      if (intrinsicW <= maxDim && intrinsicH <= maxDim) {
        return ui.TargetImageSize(width: intrinsicW, height: intrinsicH);
      }
      final scale =
          intrinsicW >= intrinsicH ? maxDim / intrinsicW : maxDim / intrinsicH;
      return ui.TargetImageSize(
        width: (intrinsicW * scale).round(),
        height: (intrinsicH * scale).round(),
      );
    });
  }

  @override
  bool operator ==(Object other) =>
      other is AuthedImageProvider && other.url == url && other.scale == scale;

  @override
  int get hashCode => Object.hash(url, scale);
}

/// Authed [ImageProvider] for a server media URL (relative or absolute).
/// Resolves against [mediaBaseUrlProvider], which respects the runtime
/// server-URL override.
ImageProvider authedImage(WidgetRef ref, String url) {
  final resolved = absoluteMediaUrl(ref.read(mediaBaseUrlProvider), url);
  return AuthedImageProvider(resolved, ref.read(dioProvider));
}
