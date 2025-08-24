
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import type { Equipment, Component, MasterComponent, UserComponent } from '@/lib/types';
import { toDate, toNullableDate } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function SystemDetailPage() {
  const params = useParams<{ id: string; system: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clientId = searchParams.get('userId');
  const systemName = useMemo(() => {
    return params.system.replace(/-/g, ' ');
  }, [params.system]);

  const fetchEquipment = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const equipmentId = params.id as string;
      const equipmentDocRef = doc(db, 'users', uid, 'equipment', equipmentId);
      const equipmentDocSnap = await getDoc(equipmentDocRef);

      if (equipmentDocSnap.exists()) {
        const equipmentData = equipmentDocSnap.data();

        // Fetch components from the subcollection
        const componentsQuery = query(collection(db, 'users', uid, 'equipment', equipmentId, 'components'));
        const componentsSnapshot = await getDocs(componentsQuery);
        const userComponents: UserComponent[] = componentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserComponent));
        
        const masterComponentIds = [...new Set(userComponents.map(c => c.masterComponentId).filter(Boolean))];
        
        const masterComponentsMap = new Map<string, MasterComponent>();
        if (masterComponentIds.length > 0) {
             for (let i = 0; i < masterComponentIds.length; i += 30) {
                const batchIds = masterComponentIds.slice(i, i + 30);
                if (batchIds.length > 0) {
                    const masterComponentsQuery = query(collection(db, 'masterComponents'), where('__name__', 'in', batchIds));
                    const querySnapshot = await getDocs(masterComponentsQuery);
                    querySnapshot.forEach(doc => {
                        masterComponentsMap.set(doc.id, { id: doc.id, ...doc.data() } as MasterComponent);
                    });
                }
            }
        }

        const combinedComponents: Component[] = userComponents.map(userComp => {
            const masterComp = masterComponentsMap.get(userComp.masterComponentId);
            if (!masterComp) {
                return null; 
            }
            return {
                ...masterComp,
                ...userComp,
                userComponentId: userComp.id,
                purchaseDate: toDate(userComp.purchaseDate),
                lastServiceDate: toNullableDate(userComp.lastServiceDate),
            };
        }).filter((c): c is Component => c !== null);

        setEquipment({
            ...equipmentData,
            id: equipmentId,
            components: combinedComponents,
        } as Equipment);

      } else {
        toast({ variant: "destructive", title: "Not Found", description: "Could not find the requested equipment." });
        setEquipment(null);
      }
    } catch (error) {
      console.error("Error fetching equipment details: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load equipment details." });
    } finally {
      setIsLoading(false);
    }
  }, [toast, params.id]);

  useEffect(() => {
    if (user && clientId) {
      fetchEquipment(clientId);
    } else if (!authLoading && !clientId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Client user ID is missing.' });
      setIsLoading(false);
    }
  }, [user, clientId, authLoading, fetchEquipment, toast]);

  const filteredComponents = useMemo(() => {
    if (!equipment) return [];
    // A special case for 'brakes' to include both disc and rim brakes
    if (systemName.toLowerCase() === 'brakes') {
        return equipment.components.filter(c => c.componentGroup && c.componentGroup.toLowerCase().includes('brake'));
    }
    return equipment.components.filter(c => c.componentGroup && c.componentGroup.toLowerCase() === systemName.toLowerCase());
  }, [equipment, systemName]);

  if (isLoading || authLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Equipment not found</h1>
          <Button asChild variant="link" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="capitalize font-headline text-primary">{systemName} Components</CardTitle>
          <CardDescription>
            Viewing components for {equipment.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredComponents.length > 0 ? (
            <div className="space-y-4">
              {filteredComponents.map(component => (
                <div key={component.userComponentId} className="p-3 border rounded-md">
                   <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{component.componentName}</span>
                        <span className="text-xs text-muted-foreground">{component.wearPercentage.toFixed(0)}% worn</span>
                    </div>
                    <Progress value={component.wearPercentage} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-2 flex justify-between">
                       <span>{component.totalDistance.toFixed(0)} km</span>
                       <span>{component.totalHours.toFixed(0)} hrs</span>
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No components found for the {systemName} system.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    