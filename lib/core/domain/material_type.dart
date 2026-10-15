enum MaterialType {
  plastic('plastic'),
  aluminium('aluminium'),
  paper('paper'),
  glass('glass'),
  unknown('unknown');

  const MaterialType(this.wireValue);
  final String wireValue;

  static MaterialType fromWire(String value) => values.firstWhere(
    (item) => item.wireValue == value,
    orElse: () => MaterialType.unknown,
  );
}
