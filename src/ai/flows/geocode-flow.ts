
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
        description: 'Get the latitude and longitude for a given address.',
        inputSchema: z.object({
            address: z.string().describe('The address to get coordinates for.'),
        }),
        outputSchema: z.object({
            lat: z.number(),
            lng: z.number(),
        }),
    },
    async (input) => {
        // In a real app, you would call a geocoding API like Google Maps here.
        // For this example, we'll use a simple mock that is more realistic.
        console.log(`Geocoding address (mock): ${input.address}`);
        const lowerCaseAddress = input.address.toLowerCase();
        if (lowerCaseAddress.includes('vancouver')) {
            return { lat: 49.2827, lng: -123.1207 };
        }
        if (lowerCaseAddress.includes('san francisco')) {
            return { lat: 37.7749, lng: -122.4194 };
        }
        if (lowerCaseAddress.includes('los angeles')) {
            return { lat: 34.0522, lng: -118.2437 };
        }
        // Default to SF for other addresses
        return { lat: 37.7749, lng: -122.4194 };
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

// A simple geohash implementation since we removed the external dependency.
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
    const llmResponse = await geocodePrompt(address);
    const coords = llmResponse.output;

    if (!coords) {
        // If the LLM fails to extract, try calling the tool directly.
        const toolResponse = await getCoordinatesTool({ address });
        if (toolResponse) {
             const geohash = geohashForLocation(toolResponse.lat, toolResponse.lng);
             return { ...toolResponse, geohash };
        }
        throw new Error('Could not geocode address. The tool did not return a valid response.');
    }

    const geohash = geohashForLocation(coords.lat, coords.lng);

    return {
      ...coords,
      geohash,
    };
  }
);
