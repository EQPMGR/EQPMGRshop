
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
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

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

const geocodeTool = ai.defineTool(
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
        // For this example, we'll use a simple mock.
        console.log(`Geocoding address (mock): ${input.address}`);
        // This is a mock response and will not be accurate.
        return { lat: 37.7749, lng: -122.4194 };
    }
);


const prompt = ai.definePrompt({
  name: 'geocodePrompt',
  input: { schema: GeocodeInputSchema },
  output: { schema: z.object({ lat: z.number(), lng: z.number() }) },
  tools: [geocodeTool],
  prompt: `Use the getCoordinates tool to find the latitude and longitude for the following address: {{{input}}}`,
});

const geocodeFlow = ai.defineFlow(
  {
    name: 'geocodeFlow',
    inputSchema: GeocodeInputSchema,
    outputSchema: GeocodeOutputSchema,
  },
  async (address) => {
    const llmResponse = await prompt(address);
    const coords = llmResponse.output();
    
    if (!coords) {
        throw new Error('Could not geocode address.');
    }

    const geohash = geohashForLocation([coords.lat, coords.lng]);

    return {
      ...coords,
      geohash,
    };
  }
);
