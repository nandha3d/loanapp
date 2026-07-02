import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/network/dio_client.dart';

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

  Future<ui.Codec> _load(
    AuthedImageProvider key,
    ImageDecoderCallback decode,
  ) async {
    final res = await _dio.get<List<int>>(
      key.url,
      options: Options(responseType: ResponseType.bytes),
    );
    final status = res.statusCode ?? 0;
    final data = res.data;
    if (status != 200 || data == null || data.isEmpty) {
      throw Exception('Image request failed ($status): ${key.url}');
    }
    final buffer =
        await ui.ImmutableBuffer.fromUint8List(Uint8List.fromList(data));
    return decode(buffer);
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
