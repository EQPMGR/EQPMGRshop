
'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries, getStates } from "@/lib/countries";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { getGeohash } from "@/ai/flows/geocode-flow";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [shopData, setShopData] = useState({
        shopName: '',
        streetAddress: '',
        city: '',
        country: '',
        state: '',
        postalCode: '',
        phone: '',
        website: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const states = getStates(selectedCountry);

    useEffect(() => {
        const fetchShopData = async () => {
            if (user) {
                const serviceProviderRef = doc(db, "serviceProviders", user.uid);
                const docSnap = await getDoc(serviceProviderRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setShopData({
                        shopName: data.shopName || '',
                        streetAddress: data.streetAddress || '',
                        city: data.city || '',
                        country: data.country || '',
                        state: data.state || '',
                        postalCode: data.postalCode || '',
                        phone: data.phone || '',
                        website: data.website || '',
                    });
                    setSelectedCountry(data.country || '');
                }
            }
            setLoading(false);
        };

        fetchShopData();
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setShopData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id: string, value: string) => {
        setShopData(prev => ({ ...prev, [id]: value }));
        if (id === 'country') {
            setSelectedCountry(value);
            setShopData(prev => ({ ...prev, state: '' })); // Reset state on country change
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) {
            toast({ title: "Error", description: "You must be logged in to save.", variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            const fullAddress = `${shopData.streetAddress}, ${shopData.city}, ${shopData.state}, ${shopData.country}, ${shopData.postalCode}`;
            const geoData = await getGeohash(fullAddress);

            const updatedData = {
                ...shopData,
                address: fullAddress,
                geohash: geoData.geohash,
                lat: geoData.lat,
                lng: geoData.lng,
                ownerId: user.uid,
            };

            const serviceProviderRef = doc(db, "serviceProviders", user.uid);
            await setDoc(serviceProviderRef, updatedData, { merge: true });

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { shopName: shopData.shopName });

            toast({ title: "Success", description: "Shop details updated successfully!" });
        } catch (error: any) {
            console.error("Error saving settings: ", error);
            toast({ title: "Error", description: error.message || "Failed to update details.", variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold text-primary">Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-primary">Shop Details</CardTitle>
          <CardDescription>Update your shop's public information. This is where geohashing is applied to your location.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name</Label>
              <Input id="shopName" value={shopData.shopName} onChange={handleInputChange} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input id="streetAddress" placeholder="123 Main St" value={shopData.streetAddress} onChange={handleInputChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Anytown" value={shopData.city} onChange={handleInputChange}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select onValueChange={(value) => handleSelectChange('country', value)} value={selectedCountry}>
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
                    <Select onValueChange={(value) => handleSelectChange('state', value)} value={shopData.state} disabled={!selectedCountry}>
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
                    <Label htmlFor="postalCode">Postal/Zip Code</Label>
                    <Input id="postalCode" placeholder="12345" value={shopData.postalCode} onChange={handleInputChange}/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="(123) 456-7890" value={shopData.phone} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" placeholder="https://mybikeshop.com" value={shopData.website} onChange={handleInputChange}/>
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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

