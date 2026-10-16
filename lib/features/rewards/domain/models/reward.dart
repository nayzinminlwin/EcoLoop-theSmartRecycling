import 'package:eco_loop/core/data/json_readers.dart';

class RewardDocument {
  const RewardDocument({
    required this.id,
    required this.title,
    required this.description,
    required this.merchantName,
    required this.categoryId,
    required this.tag,
    required this.imageUrl,
    required this.pointsCost,
    required this.expiresAt,
    required this.isActive,
    required this.maxRedemptionsPerResident,
    required this.artKey,
    required this.sortOrder,
  });

  final String id;
  final String title;
  final String description;
  final String merchantName;
  final String categoryId;
  final String? tag;
  final String? imageUrl;
  final int pointsCost;
  final DateTime expiresAt;
  final bool isActive;
  final int maxRedemptionsPerResident;
  final String artKey;
  final int sortOrder;

  factory RewardDocument.fromMap(JsonMap json) => RewardDocument(
    id: JsonReaders.string(json, 'id'),
    title: JsonReaders.string(json, 'title'),
    description: JsonReaders.string(json, 'description'),
    merchantName: JsonReaders.string(json, 'merchantName'),
    categoryId: JsonReaders.string(json, 'categoryId'),
    tag: JsonReaders.nullableString(json, 'tag'),
    imageUrl: JsonReaders.nullableString(json, 'imageUrl'),
    pointsCost: JsonReaders.integer(json, 'pointsCost'),
    expiresAt: JsonReaders.dateTime(json, 'expiresAt'),
    isActive: json['isActive'] as bool? ?? false,
    maxRedemptionsPerResident: JsonReaders.integer(
      json,
      'maxRedemptionsPerResident',
    ),
    artKey: JsonReaders.string(json, 'artKey'),
    sortOrder: JsonReaders.integer(json, 'sortOrder'),
  );

  JsonMap toMap() => {
    'id': id,
    'title': title,
    'description': description,
    'merchantName': merchantName,
    'categoryId': categoryId,
    'tag': tag,
    'imageUrl': imageUrl,
    'pointsCost': pointsCost,
    'expiresAt': expiresAt.toIso8601String(),
    'isActive': isActive,
    'maxRedemptionsPerResident': maxRedemptionsPerResident,
    'artKey': artKey,
    'sortOrder': sortOrder,
  };

  factory RewardDocument.fromJson(JsonMap json) => RewardDocument.fromMap(json);

  JsonMap toJson() => toMap();
}

class Reward {
  const Reward({
    required this.id,
    required this.title,
    required this.description,
    required this.merchantName,
    required this.categoryId,
    required this.tag,
    required this.imageUrl,
    required this.pointsCost,
    required this.expiresAt,
    required this.isActive,
    required this.maxRedemptionsPerResident,
    required this.residentRedemptionCount,
    required this.artKey,
    required this.sortOrder,
  });

  final String id;
  final String title;
  final String description;
  final String merchantName;
  final String categoryId;
  final String? tag;
  final String? imageUrl;
  final int pointsCost;
  final DateTime expiresAt;
  final bool isActive;
  final int maxRedemptionsPerResident;
  final int residentRedemptionCount;
  final String artKey;
  final int sortOrder;

  bool isExpiredAt(DateTime now) => !expiresAt.isAfter(now);

  factory Reward.fromJson(JsonMap json) => Reward(
    id: JsonReaders.string(json, 'id'),
    title: JsonReaders.string(json, 'title'),
    description: JsonReaders.string(json, 'description'),
    merchantName: JsonReaders.string(json, 'merchantName'),
    categoryId: JsonReaders.string(json, 'categoryId'),
    tag: JsonReaders.nullableString(json, 'tag'),
    imageUrl: JsonReaders.nullableString(json, 'imageUrl'),
    pointsCost: JsonReaders.integer(json, 'pointsCost'),
    expiresAt: JsonReaders.dateTime(json, 'expiresAt'),
    isActive: json['isActive'] as bool? ?? false,
    maxRedemptionsPerResident: JsonReaders.integer(
      json,
      'maxRedemptionsPerResident',
    ),
    residentRedemptionCount: JsonReaders.integer(
      json,
      'residentRedemptionCount',
    ),
    artKey: JsonReaders.string(json, 'artKey'),
    sortOrder: JsonReaders.integer(json, 'sortOrder'),
  );

  JsonMap toJson() => {
    ...RewardDocument(
      id: id,
      title: title,
      description: description,
      merchantName: merchantName,
      categoryId: categoryId,
      tag: tag,
      imageUrl: imageUrl,
      pointsCost: pointsCost,
      expiresAt: expiresAt,
      isActive: isActive,
      maxRedemptionsPerResident: maxRedemptionsPerResident,
      artKey: artKey,
      sortOrder: sortOrder,
    ).toMap(),
    'residentRedemptionCount': residentRedemptionCount,
  };
}
