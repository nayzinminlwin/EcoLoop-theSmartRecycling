import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:flutter/material.dart';

import '../../domain/models/simulation_asset.dart';

class SimulationAssetPicker extends StatelessWidget {
  const SimulationAssetPicker({
    required this.assets,
    required this.selectedAssetId,
    required this.onAssetSelected,
    super.key,
  });

  final List<SimulationAsset> assets;
  final String? selectedAssetId;
  final ValueChanged<SimulationAsset> onAssetSelected;

  @override
  Widget build(BuildContext context) {
    final available = assets.where((asset) => asset.enabled).toList();
    if (available.isEmpty) {
      return const Text('No simulation images are available.');
    }
    return Semantics(
      container: true,
      label: 'Choose one simulation image',
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final asset in available)
            Semantics(
              selected: asset.id == selectedAssetId,
              child: OutlinedButton(
                onPressed: () => onAssetSelected(asset),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  backgroundColor: asset.id == selectedAssetId
                      ? AppColors.primary
                      : AppColors.surface,
                  foregroundColor: asset.id == selectedAssetId
                      ? Colors.white
                      : AppColors.text,
                  side: BorderSide(
                    color: asset.id == selectedAssetId
                        ? AppColors.primary
                        : AppColors.border,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.button),
                  ),
                ),
                child: Text(
                  asset.displayName ?? asset.id,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
