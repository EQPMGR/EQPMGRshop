
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries, getStates } from "@/lib/countries";

export default function SettingsPage() {
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const states = getStates(selectedCountry);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold text-primary">Settings</h1>
      
      {/* Shop Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-primary">Shop Details</CardTitle>
          <CardDescription>Update your shop's public information. This is where geohashing is applied to your location.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop Name</Label>
              <Input id="shop-name" defaultValue="My Awesome Bike Shop" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="street-address">Street Address</Label>
              <Input id="street-address" placeholder="123 Main St" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Anytown" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select onValueChange={setSelectedCountry} value={selectedCountry}>
                        <SelectTrigger id="country">
                            <SelectValue placeholder="Select Country" />
                        </SelectTrigger>
                        <SelectContent>
                            {countries.map((country) => (
                                <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="state">Province/State</Label>
                    <Select disabled={!selectedCountry}>
                        <SelectTrigger id="state">
                            <SelectValue placeholder={selectedCountry ? "Select Province/State" : "Select Country First"} />
                        </SelectTrigger>
                        <SelectContent>
                             {states.map((state) => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="postal-code">Postal/Zip Code</Label>
                    <Input id="postal-code" placeholder="12345" />
                </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="(123) 456-7890" />
                </div>
                <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" placeholder="https://mybikeshop.com" />
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-accent hover:bg-accent/90">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Billing Card */}
      <Card>
        <CardHeader>
            <CardTitle className="font-headline text-primary">Billing</CardTitle>
            <CardDescription>Manage your subscription and payment methods.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-muted-foreground">Stripe integration coming soon!</p>
                <p className="text-sm text-muted-foreground">You will be able to manage your billing and subscription here.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="promo-code">Promo Code</Label>
                <div className="flex gap-2">
                    <Input id="promo-code" placeholder="Enter your promo code" />
                    <Button variant="outline">Apply</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Have a promo code? Enter it here to get your first 10 work orders free.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
