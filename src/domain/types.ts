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
  photoBytes: number;
  createdAt: string;
}

export interface Order {
  id: string;
  orderDate: string | null;
  shop: string | null;
  currency: string;
  shippingMinor: number;
  totalMinor: number | null;
  sgdPaidMinor: number | null;
  estimated: boolean;
  isUnknown: boolean;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  orderId: string;
  sheetId: string;
  quantity: number;
  priceMinor: number | null;
  estimated: boolean;
}

export interface Usage {
  id: string;
  sheetId: string;
  quantity: number;
  usedOn: string;
}

export interface ShareLink {
  token: string;
  enabled: boolean;
}