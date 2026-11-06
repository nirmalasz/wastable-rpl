import { describe, expect, it } from 'vitest';
import { priceLabel } from './listing-card';
import { mapLink, offerOf } from './listing-form';

describe('priceLabel', () => {
  it('shows the price for sales and a word for the other offer types', () => {
    expect(priceLabel({ listingType: 'SELL', price: 13000 })).toBe('Rp 13.000');
    expect(priceLabel({ listingType: 'FREE', price: 0 })).toBe('Free');
    expect(priceLabel({ listingType: 'EXCHANGE', price: 0 })).toBe('Exchange');
  });
});

describe('offerOf (what the form sends)', () => {
  it('keeps a priced sale', () => {
    expect(offerOf({ listingType: 'SELL', price: '8000' })).toEqual({
      listingType: 'SELL',
      price: 8000,
    });
  });

  it.each(['0', '', '-5'])('turns a sale priced %j into a free listing', (price) => {
    expect(offerOf({ listingType: 'SELL', price })).toEqual({ listingType: 'FREE', price: 0 });
  });

  it('never sends a price for free or exchange listings', () => {
    expect(offerOf({ listingType: 'EXCHANGE', price: '5000' })).toEqual({
      listingType: 'EXCHANGE',
      price: 0,
    });
    expect(offerOf({ listingType: 'FREE', price: '5000' })).toEqual({
      listingType: 'FREE',
      price: 0,
    });
  });
});

describe('mapLink', () => {
  it('points OpenStreetMap at the pin', () => {
    const url = new URL(mapLink({ lat: -6.3646, lng: 106.8287 }));
    expect(url.hostname).toBe('www.openstreetmap.org');
    expect(url.searchParams.get('mlat')).toBe('-6.3646');
    expect(url.searchParams.get('mlon')).toBe('106.8287');
  });
});
