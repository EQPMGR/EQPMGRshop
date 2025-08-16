
'use server';
/**
 * @fileOverview A flow for geocoding addresses.
 *
 * - getGeohash - A function that takes an address and returns a geohash, latitude, and longitude.
 * - GeocodeInput - The input type for the geocoding flow.
 * - GeocodeOutput - The return type for the geocoding flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GeocodeInputSchema = z.string().describe("The full address to geocode.");
export type GeocodeInput = z.infer<typeof GeocodeInputSchema>;

const GeocodeOutputSchema = z.object({
  lat: z.number().describe('The latitude of the address.'),
  lng: z.number().describe('The longitude of the address.'),
  geohash: z.string().describe('The geohash of the address.'),
});
export type GeocodeOutput = z.infer<typeof GeocodeOutputSchema>;

export async function getGeohash(input: GeocodeInput): Promise<GeocodeOutput> {
  return geocodeFlow(input);
}

const getCoordinatesTool = ai.defineTool(
    {
        name: 'getCoordinates',
        description: 'Get the latitude and longitude for a given address using Google Geocoding API.',
        inputSchema: z.object({
            address: z.string().describe('The address to get coordinates for.'),
        }),
        outputSchema: z.object({
            lat: z.number(),
            lng: z.number(),
        }),
    },
    async (input) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Google Geocoding API key (GEMINI_API_KEY) is missing.');
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input.address)}&key=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Google Geocoding API failed with status: ${response.status}`);
            }
            const data = await response.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                const { lat, lng } = location;
                console.log(`Geocoded address '${input.address}' to:`, { lat, lng });
                return { lat, lng };
            } else {
                 throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'No results found.'}`);
            }
        } catch (error) {
            console.error('Error calling Google Geocoding API:', error);
            throw new Error('Failed to fetch coordinates from Google Geocoding API.');
        }
    }
);


const geocodePrompt = ai.definePrompt({
  name: 'geocodePrompt',
  input: { schema: GeocodeInputSchema },
  output: { schema: z.object({ lat: z.number(), lng: z.number() }) },
  tools: [getCoordinatesTool],
  prompt: `You are a geocoding assistant. Your task is to find the geographic coordinates for the given address and then output them in the specified format.

Use the getCoordinates tool to find the latitude and longitude for the following address: {{{input}}}

After using the tool, you MUST output the latitude and longitude in the required JSON format. Do not add any commentary or additional text.`,
});

// A simple geohash implementation.
const geohashForLocation = (lat: number, lon: number, precision: number = 9): string => {
    const BITS = [16, 8, 4, 2, 1];
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let geohash = "";
    let is_even = true;
    let lat_range = [-90.0, 90.0];
    let lon_range = [-180.0, 180.0];
    let bit = 0;
    let ch = 0;

    while (geohash.length < precision) {
        let mid;
        if (is_even) {
            mid = (lon_range[0] + lon_range[1]) / 2;
            if (lon > mid) {
                ch |= BITS[bit];
                lon_range[0] = mid;
            } else {
                lon_range[1] = mid;
            }
        } else {
            mid = (lat_range[0] + lat_range[1]) / 2;
            if (lat > mid) {
                ch |= BITS[bit];
                lat_range[0] = mid;
            } else {
                lat_range[1] = mid;
            }
        }

        is_even = !is_even;
        if (bit < 4) {
            bit++;
        } else {
            geohash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }
    return geohash;
};


const geocodeFlow = ai.defineFlow(
  {
    name: 'geocodeFlow',
    inputSchema: GeocodeInputSchema,
    outputSchema: GeocodeOutputSchema,
  },
  async (address) => {
    const toolResponse = await getCoordinatesTool({ address });
    if (!toolResponse) {
      throw new Error('Could not geocode address. The tool did not return a valid response.');
    }
    
    const geohash = geohashForLocation(toolResponse.lat, toolResponse.lng);

    return {
      ...toolResponse,
      geohash,
    };
  }
);

