import 'package:flutter/material.dart';

abstract final class AppShadows {
  static const main = [
    BoxShadow(color: Color(0x14183423), offset: Offset(0, 8), blurRadius: 28),
  ];
  static const scanButton = [
    BoxShadow(color: Color(0x4D176B45), offset: Offset(0, 5), blurRadius: 15),
  ];
  static const shellFrame = [
    BoxShadow(color: Color(0x14283C2D), offset: Offset(0, 0), blurRadius: 50),
  ];
}
