import 'package:flutter/material.dart';

abstract final class AppMotion {
  static const buttonFeedback = Duration(milliseconds: 200);
  static const scanRotation = Duration(seconds: 2);

  static Duration accessible(Duration duration, BuildContext context) {
    return MediaQuery.maybeOf(context)?.disableAnimations == true
        ? Duration.zero
        : duration;
  }
}
