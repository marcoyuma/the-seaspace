// Indonesian rupiah, no decimals (e.g. "Rp2.500.000"). Built once at module
// scope so we don't allocate a formatter per render, and shared so the listing
// card and the detail page can't drift into two different price formats.
export const idr = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});
