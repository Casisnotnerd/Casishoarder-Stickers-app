export interface Artist {
  id: string;
  name: string;
  aliases: string[];
}

export interface Sheet {
  id: string;
  artistId: string | null;
  title: string;
  tags: string[];
  photoPath: string | null;
  thumbPath: string | null;
  photoBytes: number; // photo + thumbnail bytes, for the storage meter
  imageHash: string | null; // perceptual hash for duplicate detection
  createdAt: string; // ISO timestamp
}

export interface Order {
  id: string;
  orderDate: string | null; // YYYY-MM-DD
  shop: string | null;
  currency: string; // ISO 4217, e.g. KRW, SGD
  shippingMinor: number; // in order currency minor units
  totalMinor: number | null; // order total as charged, order currency
  sgdPaidMinor: number | null; // SGD actually paid, cents
  estimated: boolean;
  isUnknown: boolean; // the per-user "Unknown order" for old sheets
  createdAt: string;
}

export interface OrderLine {
  id: string;
  orderId: string;
  sheetId: string;
  quantity: number;
  priceMinor: number | null; // listed price each, order currency
  estimated: boolean;
}

export interface Usage {
  id: string;
  sheetId: string;
  quantity: number;
  usedOn: string; // YYYY-MM-DD
}

export interface ShareLink {
  token: string;
  enabled: boolean;
}
