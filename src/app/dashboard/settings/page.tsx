
'use client';

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries, getStates } from "@/lib/countries";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { getGeohash } from "@/ai/flows/geocode-flow";
import { Loader2, UploadCloud } from "lucide-react";
import { createPortalSession } from "../actions/stripe";

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
        logoUrl: '',
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [billingLoading, setBillingLoading] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const states = getStates(selectedCountry);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        logoUrl: data.logoUrl || '',
                    });
                    setSelectedCountry(data.country || '');
                    if (data.logoUrl) {
                        setLogoPreview(data.logoUrl);
                    }
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
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
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
            let logoUrl = shopData.logoUrl;
            if (logoFile) {
                const storageRef = ref(storage, `logos/${user.uid}/${logoFile.name}`);
                await uploadBytes(storageRef, logoFile);
                logoUrl = await getDownloadURL(storageRef);
            }

            const fullAddress = `${shopData.streetAddress}, ${shopData.city}, ${shopData.state}, ${shopData.country}, ${shopData.postalCode}`;
            const geoData = await getGeohash(fullAddress);

            let websiteUrl = shopData.website;
            if (websiteUrl && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
                websiteUrl = `https://${websiteUrl}`;
            }

            const updatedData = {
                ...shopData,
                logoUrl,
                website: websiteUrl,
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

    const handleManageBilling = async () => {
        if (!user) {
            toast({ title: "Error", description: "You must be logged in.", variant: 'destructive'});
            return;
        }
        setBillingLoading(true);
        try {
            const { url } = await createPortalSession(user.uid);
            if (url) {
                window.location.href = url;
            } else {
                toast({ title: "Error", description: "Could not create billing session. Please try again.", variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: 'destructive' });
        } finally {
            setBillingLoading(false);
        }
    }

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
          <CardDescription>Update your shop's public information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
                <Label>Shop Logo</Label>
                <div className="flex items-center gap-4">
                     <div 
                        className="relative h-24 w-24 rounded-md border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary"
                        onClick={() => fileInputRef.current?.click()}
                     >
                        {logoPreview ? (
                            <Image src={logoPreview} alt="Logo Preview" layout="fill" className="rounded-md object-cover"/>
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <UploadCloud className="mx-auto h-8 w-8"/>
                                <span className="text-xs">Upload</span>
                            </div>
                        )}
                         <Input
                            id="logo"
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif"
                            onChange={handleLogoChange}
                        />
                     </div>
                     <div className="text-sm text-muted-foreground">
                        <p>Recommended size: 100x100px.</p>
                        <p>Max file size: 1MB.</p>
                     </div>
                </div>
            </div>

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
                <Input id="website" type="text" placeholder="mybikeshop.com" value={shopData.website} onChange={handleInputChange}/>
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
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
                <p><b>Subscription and Billing Information</b></p>
                <p>Welcome! To ensure your shop can start receiving work orders from athletes, you need to set up your payment method through our secure Stripe portal.</p>
                <p><b>How Billing Works:</b></p>
                <ul>
                    <li><b>Cost:</b> You will be charged $2.00 CAD (Canadian Dollars) for every new work order your shop successfully receives.</li>
                    <li><b>Billing Cycle:</b> We aggregate your usage over the month. On the 20th of every month, Stripe will automatically process a single charge for the total number of work orders received in the previous month.</li>
                    <li><b>Mandatory Setup:</b> Setting up a valid payment method via Stripe is required to activate your shop and become eligible to receive work orders from our network of athletes. Your shop will not appear as available until this setup is complete.</li>
                </ul>
                <p><b>Next Step: Manage Billing</b></p>
                <p>Clicking the "Powered by Stripe" button will securely redirect you to the Stripe Customer Portal. Stripe handles all payment processing and card data; we never store your sensitive information.</p>
                <ul>
                    <li>If this is your first time, you will be prompted to securely enter your credit card details.</li>
                    <li>If you are already signed up, you can use the portal to update your card, view past invoices, or check your current plan status.</li>
                </ul>
            </div>

            <div className="rounded-lg border border-border p-4 text-center">
                 <Button onClick={handleManageBilling} disabled={billingLoading} variant="ghost" className="h-auto p-0 hover:bg-transparent">
                    {billingLoading ? <Loader2 className="h-8 w-32 animate-spin" /> : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-22.35 -10.25 193.7 61.5" className="h-10 w-auto">
                            <path d="M6 0h137c3.314 0 6 2.686 6 6v29c0 3.314-2.686 6-6 6H6c-3.314 0-6-2.686-6-6V6c0-3.314 2.686-6 6-6z" fill="#32364E" fillRule="evenodd"></path>
                            <path d="M71.403 26.625h-1.462l1.132-2.796-2.253-5.685h1.545l1.416 3.869 1.427-3.869h1.545zm-5.615-2.442c-.507 0-1.026-.188-1.498-.554v.413h-1.509v-8.481h1.509v2.985c.472-.354.991-.543 1.498-.543 1.581 0 2.666 1.274 2.666 3.09 0 1.816-1.085 3.09-2.666 3.09zM65.47 19.3c-.413 0-.826.177-1.18.531v2.524c.354.354.767.531 1.18.531.849 0 1.439-.731 1.439-1.793 0-1.061-.59-1.793-1.439-1.793zm-8.8 4.329c-.46.366-.979.554-1.498.554-1.569 0-2.665-1.274-2.665-3.09 0-1.816 1.096-3.09 2.665-3.09.519 0 1.038.189 1.498.543v-2.985h1.522v8.481H56.67zm0-3.798c-.342-.354-.755-.531-1.168-.531-.861 0-1.45.732-1.45 1.793 0 1.062.589 1.793 1.45 1.793.413 0 .826-.177 1.168-.531zm-8.988 1.675c.094.896.802 1.51 1.793 1.51.542 0 1.144-.201 1.757-.555v1.262c-.672.307-1.344.46-2.005.46-1.781 0-3.031-1.297-3.031-3.137 0-1.781 1.227-3.043 2.913-3.043 1.545 0 2.595 1.215 2.595 2.949 0 .165 0 .353-.024.554zm1.368-2.335c-.731 0-1.297.542-1.368 1.356h2.571c-.047-.802-.531-1.356-1.203-1.356zm-5.343.931v3.94h-1.51v-5.898h1.51v.59c.424-.472.943-.731 1.45-.731.166 0 .331.012.496.059v1.345c-.165-.048-.354-.071-.531-.071-.495 0-1.026.271-1.415.766zm-6.736 1.404c.095.896.802 1.51 1.793 1.51.543 0 1.144-.201 1.758-.555v1.262c-.673.307-1.345.46-2.006.46-1.781 0-3.031-1.297-3.031-3.137 0-1.781 1.227-3.043 2.913-3.043 1.546 0 2.595 1.215 2.595 2.949 0 .165 0 .353-.023.554zm1.368-2.335c-.731 0-1.297.542-1.368 1.356h2.572c-.048-.802-.531-1.356-1.204-1.356zm-6.641 4.871l-1.203-4.01-1.191 4.01h-1.357l-2.028-5.898h1.509l1.192 4.011 1.191-4.011h1.368l1.191 4.011 1.192-4.011h1.509l-2.017 5.898zm-9.224.141c-1.781 0-3.043-1.285-3.043-3.09 0-1.816 1.262-3.09 3.043-3.09 1.781 0 3.031 1.274 3.031 3.09 0 1.805-1.25 3.09-3.031 3.09zm0-4.918c-.885 0-1.498.743-1.498 1.828s.613 1.828 1.498 1.828c.873 0 1.486-.743 1.486-1.828s-.613-1.828-1.486-1.828zm-6.629 1.864h-1.357v2.913h-1.509v-8.115h2.866c1.651 0 2.83 1.073 2.83 2.607 0 1.533-1.179 2.595-2.83 2.595zm-.213-3.975h-1.144v2.748h1.144c.873 0 1.486-.554 1.486-1.368 0-.826-.613-1.38-1.486-1.38zm121.195 4.714h-7.25c.165 1.736 1.437 2.247 2.88 2.247 1.471 0 2.629-.309 3.639-.819v2.984c-1.007.557-2.335.96-4.106.96-3.607 0-6.135-2.259-6.135-6.726 0-3.772 2.144-6.768 5.668-6.768 3.518 0 5.354 2.995 5.354 6.788 0 .358-.033 1.134-.05 1.334zm-5.328-5.102c-.926 0-1.955.699-1.955 2.368h3.829c0-1.667-.964-2.368-1.874-2.368zM119.981 27.24c-1.296 0-2.088-.547-2.62-.937l-.008 4.191-3.703.788-.002-17.289h3.262l.192.915c.513-.479 1.45-1.162 2.902-1.162 2.601 0 5.051 2.343 5.051 6.655 0 4.707-2.424 6.839-5.074 6.839zm-.862-10.213c-.851 0-1.383.311-1.769.734l.022 5.504c.359.389.878.703 1.747.703 1.369 0 2.287-1.491 2.287-3.485 0-1.938-.932-3.456-2.287-3.456zm-10.702-3.034h3.718v12.982h-3.718zm0-4.145l3.718-.791v3.017l-3.718.79zm-3.841 8.326v8.801h-3.702V13.993h3.202l.233 1.095c.866-1.594 2.598-1.271 3.091-1.094v3.404c-.471-.152-1.949-.374-2.824.776zm-7.817 4.246c0 2.183 2.337 1.504 2.812 1.314v3.015c-.494.271-1.389.491-2.6.491-2.198 0-3.847-1.619-3.847-3.812l.016-11.883 3.616-.768.003 3.216h2.813v3.158h-2.813zm-4.494.632c0 2.666-2.122 4.188-5.202 4.188-1.277 0-2.673-.248-4.05-.841v-3.536c1.243.676 2.827 1.183 4.054 1.183.826 0 1.421-.222 1.421-.906 0-1.768-5.631-1.102-5.631-5.203 0-2.622 2.003-4.191 5.007-4.191 1.227 0 2.454.189 3.681.678v3.488c-11.27-.608-2.557-.953-3.684-.953-.776 0-1.258.224-1.258.803 0 1.666 5.662.874 5.662 5.29z" fill="#FFF" fillRule="evenodd"></path>
                        </svg>
                    )}
                </Button>
            </div>
            
        </CardContent>
      </Card>
    </div>
  );
}
