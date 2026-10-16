import 'package:flutter/material.dart';

import '../../domain/models/smart_bin.dart';

class BinDetailsCard extends StatelessWidget {
  const BinDetailsCard({super.key, required this.bin});
  final SmartBin bin;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(bin.id, style: Theme.of(context).textTheme.titleMedium),
          Text('${bin.locationName} · ${bin.locationDetail}'),
          const SizedBox(height: 8),
          Text('Capacity ${bin.capacityPercent}%'),
          Text(
            'Accepts ${bin.acceptedMaterials.map((item) => item.wireValue).join(', ')}',
          ),
        ],
      ),
    ),
  );
}
