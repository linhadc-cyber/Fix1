/** Danh mục thiết bị Fix1 — nguồn chuẩn cho seed + migrate. */
export type EquipmentCatalogItem = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  /** Slug cũ cần đổi tên / gộp vào mục này */
  aliases?: string[];
};

export const EQUIPMENT_CATALOG: EquipmentCatalogItem[] = [
  {
    slug: "tu-nap",
    name: "Tủ nạp",
    description: "Tủ nạp / chỉnh lưu",
    sortOrder: 1,
    aliases: ["tu-chinh-luu"],
  },
  {
    slug: "acquy",
    name: "Acquy",
    description: "Ắc quy / pin dự phòng",
    sortOrder: 2,
    aliases: ["ac-quy"],
  },
  {
    slug: "inverter",
    name: "Inverter",
    description: "Bộ biến tần / inverter",
    sortOrder: 3,
  },
  {
    slug: "giam-sat-aq",
    name: "Giám sát AQ",
    description: "Giám sát ắc quy (BACS…)",
    sortOrder: 4,
    aliases: ["bacs"],
  },
  {
    slug: "giam-sat-dc",
    name: "Giám sát DC",
    description: "Giám sát DC / chạm đất (Dossena…)",
    sortOrder: 5,
    aliases: ["dossena"],
  },
  {
    slug: "ups",
    name: "UPS",
    description: "Bộ lưu điện UPS",
    sortOrder: 6,
  },
  {
    slug: "cac-san-pham-khac",
    name: "Các sản phẩm khác",
    description: "Sản phẩm / kiến thức không thuộc nhóm trên",
    sortOrder: 7,
    aliases: ["chung", "nguon-1-chieu", "kiến-thức-chung"],
  },
];

export const EQUIPMENT_SLUGS = EQUIPMENT_CATALOG.map((e) => e.slug);

/** Map slug cũ → slug mới (để redirect / import). */
export function resolveEquipmentSlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  for (const item of EQUIPMENT_CATALOG) {
    if (item.slug === s) return item.slug;
    if (item.aliases?.includes(s)) return item.slug;
  }
  return s;
}
