
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getGeohash } from '@/ai/flows/geocode-flow';

const onboardingSchema = z.object({
    shopName: z.string().min(1, "Shop name is required"),
    address: z.string().min(1, "Address is required"),
    phone: z.string().min(1, "Phone number is required"),
    services: z.enum(["repairs", "rentals", "fitting"]),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<OnboardingFormValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            shopName: '',
            address: '',
            phone: '',
            services: 'repairs',
        }
    });

    const onSubmit = async (data: OnboardingFormValues) => {
        if (!user) {
            setError("You must be logged in to continue.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Get geohash for the address
            const geoData = await getGeohash(data.address);

            // 2. Update the user document
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                shopName: data.shopName,
                address: data.address,
                phone: data.phone,
                services: data.services,
                geohash: geoData.geohash,
                lat: geoData.lat,
                lng: geoData.lng,
                onboardingComplete: true
            });

            // 3. Create a new document in serviceProviders
            const serviceProviderRef = doc(db, "serviceProviders", user.uid);
            await setDoc(serviceProviderRef, {
                shopName: data.shopName,
                address: data.address,
                phone: data.phone,
                services: data.services,
                geohash: geoData.geohash,
                lat: geoData.lat,
                lng: geoData.lng,
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
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                            <Label htmlFor="address">Full Shop Address</Label>
                            <Controller
                                name="address"
                                control={control}
                                render={({ field }) => <Textarea id="address" placeholder="123 Main St, Anytown, USA 12345" {...field} />}
                            />
                            {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
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
                            <Label>Primary Service</Label>
                            <Controller
                                name="services"
                                control={control}
                                render={({ field }) => (
                                    <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-col space-y-1"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="repairs" id="repairs" />
                                            <Label htmlFor="repairs">Bicycle Repairs</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="rentals" id="rentals" />
                                            <Label htmlFor="rentals">Bicycle Rental</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="fitting" id="fitting" />
                                            <Label htmlFor="fitting">Bike Fit Services</Label>
                                        </div>
                                    </RadioGroup>
                                )}
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading}>
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Shop Information'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
