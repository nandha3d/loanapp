import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http_parser/http_parser.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class UploadResult {
  const UploadResult({required this.url, required this.filename});
  final String url;
  final String filename;
}

class UploadService {
  UploadService(this._dio);
  final Dio _dio;

  Future<UploadResult> uploadFile(File file, {String? contentType}) async {
    MediaType? mediaType;
    final pathLower = file.path.toLowerCase();

    // Always honour the actual file extension for WebP — cropSquarePhoto()
    // compresses to WebP but many call-sites still pass contentType 'image/jpeg'.
    // The server validates magic bytes against the declared MIME and would reject
    // the mismatch.
    if (pathLower.endsWith('.webp')) {
      mediaType = MediaType('image', 'webp');
    } else if (contentType != null) {
      mediaType = MediaType.parse(contentType);
    } else {
      if (pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg')) {
        mediaType = MediaType('image', 'jpeg');
      } else if (pathLower.endsWith('.png')) {
        mediaType = MediaType('image', 'png');
      } else if (pathLower.endsWith('.pdf')) {
        mediaType = MediaType('application', 'pdf');
      } else if (pathLower.endsWith('.m4a')) {
        mediaType = MediaType('audio', 'm4a');
      } else if (pathLower.endsWith('.aac')) {
        mediaType = MediaType('audio', 'aac');
      } else if (pathLower.endsWith('.mp3')) {
        mediaType = MediaType('audio', 'mpeg');
      } else if (pathLower.endsWith('.webm')) {
        mediaType = MediaType('audio', 'webm');
      }
    }

    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.path.split(Platform.pathSeparator).last,
        contentType: mediaType,
      ),
    });
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.upload,
      data: form,
      options: Options(contentType: 'multipart/form-data'),
    );
    return unwrapEnvelope(res, (dynamic d) {
      final map = d as Map<String, dynamic>;
      return UploadResult(
        url: map['url'] as String,
        filename: map['filename'] as String,
      );
    });
  }
}

final uploadServiceProvider = Provider<UploadService>(
  (ref) => UploadService(ref.watch(dioProvider)),
);
