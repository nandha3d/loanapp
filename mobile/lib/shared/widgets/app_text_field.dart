import 'package:flutter/material.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.hintText,
    this.obscureText = false,
    this.prefixIcon,
    this.suffixIcon,
    this.errorText,
    this.keyboardType,
    this.autofillHints,
    this.onChanged,
  });

  final String label;
  final TextEditingController? controller;
  final String? hintText;
  final bool obscureText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final String? errorText;
  final TextInputType? keyboardType;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.label),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          autofillHints: autofillHints,
          onChanged: onChanged,
          style: AppTypography.body,
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: AppTypography.body.copyWith(color: AppColors.textLight),
            prefixIcon: prefixIcon != null
                ? Icon(prefixIcon, size: 18, color: AppColors.textSecondary)
                : null,
            suffixIcon: suffixIcon,
            errorText: errorText,
            errorStyle: AppTypography.caption.copyWith(color: AppColors.danger),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
