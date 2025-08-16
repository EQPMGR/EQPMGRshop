
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getGeohash } from '@/ai/flows/geocode-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries, getStates } from '@/lib/countries';
import { Checkbox } from '@/components/ui/checkbox';

const onboardingSchema = z.object({
    shopName: z.string().min(1, "Shop name is required"),
    streetAddress: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State/Province is required"),
    country: z.string().min(1, "Country is required"),
    postalCode: z.string().min(1, "Postal/Zip code is required"),
    phone: z.string().min(1, "Phone number is required"),
    services: z.object({
        repairs: z.boolean().default(false),
        rentals: z.boolean().default(false),
        fitting: z.boolean().default(false),
    }).refine(data => data.repairs || data.rentals || data.fitting, {
        message: "Please select at least one service.",
        path: ['repairs'], // Assign error to one of the checkboxes
    }),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const serviceOptions = [
    { id: 'repairs', label: 'Bicycle Repairs' },
    { id: 'rentals', label: 'Bicycle Rental' },
    { id: 'fitting', label: 'Bike Fit Services' },
] as const;


export default function OnboardingPage() {
    const { user, loading: authLoading, shopName } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    

    const { control, handleSubmit, watch, formState: { errors, isValid }, reset } = useForm<OnboardingFormValues>({
        resolver: zodResolver(onboardingSchema),
        mode: 'onChange', // Enable validation on change
        defaultValues: {
            shopName: '',
            streetAddress: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
            phone: '',
            services: {
                repairs: false,
                rentals: false,
                fitting: false,
            },
        }
    });

    const states = getStates(selectedCountry);
    const watchedCountry = watch("country");

    useEffect(() => {
        if (shopName) {
            reset({ shopName: shopName });
        }
    }, [shopName, reset]);

    useEffect(() => {
        if (watchedCountry) {
            setSelectedCountry(watchedCountry);
        }
    }, [watchedCountry]);

    const onSubmit = async (data: OnboardingFormValues) => {
        if (!user) {
            setError("You must be logged in to continue.");
            return;
        }

        setLoading(true);
        setError(null);

        const fullAddress = `${data.streetAddress}, ${data.city}, ${data.state}, ${data.country}, ${data.postalCode}`;
        
        const selectedServices = Object.entries(data.services)
            .filter(([, value]) => value)
            .map(([key]) => key);

        try {
            // 1. Get geohash for the address
            const geoData = await getGeohash(fullAddress);

            const shopData = {
                shopName: data.shopName,
                address: fullAddress,
                streetAddress: data.streetAddress,
                city: data.city,
                state: data.state,
                country: data.country,
                postalCode: data.postalCode,
                phone: data.phone,
                services: selectedServices,
                geohash: geoData.geohash,
                lat: geoData.lat,
                lng: geoData.lng,
            }

            // 2. Update the user document
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                ...shopData,
                onboardingComplete: true
            });

            // 3. Create a new document in serviceProviders
            const serviceProviderRef = doc(db, "serviceProviders", user.uid);
            await setDoc(serviceProviderRef, {
                ...shopData,
                ownerId: user.uid,
            });

            toast({
                title: "Shop Information Saved!",
                description: "Your shop is now set up.",
            });
            router.push('/dashboard');

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    
    // Redirect if user is not logged in or has already completed onboarding
    useEffect(() => {
        if (!authLoading && user) {
            const userDocRef = doc(db, "users", user.uid);
            getDoc(userDocRef).then(docSnap => {
                if (docSnap.exists() && docSnap.data().onboardingComplete) {
                    router.push('/dashboard');
                }
            });
        }
         if (!authLoading && !user) {
            router.push('/');
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return (
             <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }


    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle className="font-headline text-primary">Almost there!</CardTitle>
                    <CardDescription>
                        Complete your shop profile to get started. This information will be displayed publicly.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="shopName">Shop Name</Label>
                            <Controller
                                name="shopName"
                                control={control}
                                render={({ field }) => <Input id="shopName" {...field} />}
                            />
                            {errors.shopName && <p className="text-sm text-destructive">{errors.shopName.message}</p>}
                        </div>

                         <div className="space-y-2">
                            <Label htmlFor="streetAddress">Street Address</Label>
                             <Controller
                                name="streetAddress"
                                control={control}
                                render={({ field }) => <Input id="streetAddress" placeholder="123 Main St" {...field} />}
                            />
                            {errors.streetAddress && <p className="text-sm text-destructive">{errors.streetAddress.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                 <Controller
                                    name="city"
                                    control={control}
                                    render={({ field }) => <Input id="city" placeholder="Anytown" {...field} />}
                                />
                                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
                            </div>
                           <div className="space-y-2">
                                <Label htmlFor="country">Country</Label>
                                 <Controller
                                    name="country"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger id="country">
                                                <SelectValue placeholder="Select Country" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {countries.map((country) => (
                                                    <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="state">Province/State</Label>
                                 <Controller
                                    name="state"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCountry}>
                                            <SelectTrigger id="state">
                                                <SelectValue placeholder={selectedCountry ? "Select Province/State" : "Select Country First"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {states.map((state) => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="postalCode">Postal/Zip Code</Label>
                                <Controller
                                    name="postalCode"
                                    control={control}
                                    render={({ field }) => <Input id="postalCode" placeholder="12345" {...field} />}
                                />
                                {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                             <Controller
                                name="phone"
                                control={control}
                                render={({ field }) => <Input id="phone" type="tel" {...field} />}
                            />
                            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Services Offered</Label>
                            <div className="flex flex-col space-y-2">
                                {serviceOptions.map(item => (
                                    <Controller
                                        key={item.id}
                                        name={`services.${item.id}`}
                                        control={control}
                                        render={({ field }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    id={item.id}
                                                />
                                                <Label htmlFor={item.id} className="font-normal">{item.label}</Label>
                                            </div>
                                        )}
                                    />
                                ))}
                            </div>
                            {errors.services?.root && <p className="text-sm text-destructive">{errors.services.root.message}</p>}
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={!isValid || loading}>
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Shop Information'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
