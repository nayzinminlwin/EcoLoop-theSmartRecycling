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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final asset in available)
            Semantics(
              button: true,
              selected: asset.id == selectedAssetId,
              label: '${asset.displayName ?? asset.id}'
                  '${asset.id == selectedAssetId ? ', selected' : ''}',
              child: InkWell(
                onTap: () => onAssetSelected(asset),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: [
                      Icon(
                        asset.id == selectedAssetId
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                        semanticLabel: asset.id == selectedAssetId
                            ? 'Selected'
                            : 'Not selected',
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(asset.displayName ?? asset.id),
                      ),
                      Text(asset.version),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
