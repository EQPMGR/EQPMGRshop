import { NextResponse } from 'next/server';

type GeocodeRequest = {
  address: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as GeocodeRequest | null;
  const address = body?.address?.trim();

  if (!address) {
    return NextResponse.json({ error: 'Address is required for geocoding.' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EQPMGRshop/1.0 (https://eqpmgrshop.example.com)',
      },
    });
  } catch (fetchError) {
    console.error('Geocoding request failed:', fetchError);
    return NextResponse.json({ error: 'Geocoding provider error.' }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: 'Geocoding provider error.' }, { status: 502 });
  }

  let results;
  try {
    results = await response.json();
  } catch (parseError) {
    console.error('Failed to parse geocoding response:', parseError);
    return NextResponse.json({ error: 'Geocoding provider error.' }, { status: 502 });
  }

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: 'Address could not be geocoded.' }, { status: 404 });
  }

  const result = results[0];
  const lat = Number(result.lat);
  const lng = Number(result.lon);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'Geocoding returned invalid coordinates.' }, { status: 502 });
  }

  return NextResponse.json({ lat, lng, displayName: result.display_name });
}
