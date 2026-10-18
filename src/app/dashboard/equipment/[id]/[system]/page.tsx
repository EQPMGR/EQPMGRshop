
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/supabase';
import type { Equipment, Component, MasterComponent, UserComponent } from '@/lib/types';
import { toDate, toNullableDate } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComponentStatusList } from '@/components/component-status-list';

export default function SystemDetailPage() {
  const params = useParams<{ id: string; system: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clientId = searchParams.get('userId');
  
  const systemName = useMemo(() => {
    if (!params.system) return '';
    return params.system.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [params.system]);

  const fetchEquipmentAndComponents = useCallback(async (uid: string, equipmentId: string) => {
    setIsLoading(true);
    try {
      // Fetch equipment
      const { data: equipmentData, error: equipmentError } = await db
        .from('equipment')
        .select('*')
        .eq('id', equipmentId)
        .eq('user_id', uid)
        .single();

      if (equipmentError || !equipmentData) {
         toast({ variant: "destructive", title: "Not Found", description: "Could not find the requested equipment." });
         setEquipment(null);
      } else {
        setEquipment(equipmentData as Equipment);
      }

      // Fetch components for this equipment
      const { data: userComponentsData, error: componentsError } = await db
        .from('components')
        .select('*')
        .eq('equipment_id', equipmentId)
        .eq('user_id', uid);

      if (componentsError) throw componentsError;

      const userComponents: UserComponent[] = (userComponentsData || []) as UserComponent[];

      // Get unique master component IDs
      const masterComponentIds = [...new Set(userComponents.map(c => c.master_component_id).filter(Boolean))];
      const masterComponentsMap = new Map<string, MasterComponent>();

      if (masterComponentIds.length > 0) {
           // Fetch master components in batches of 30
           for (let i = 0; i < masterComponentIds.length; i += 30) {
              const batchIds = masterComponentIds.slice(i, i + 30);
               if (batchIds.length > 0) {
                  const { data: masterCompsData, error: masterError } = await db
                    .from('master_components')
                    .select('*')
                    .in('id', batchIds);

                  if (masterError) throw masterError;

                  (masterCompsData || []).forEach((masterComp: any) => {
                      masterComponentsMap.set(masterComp.id, masterComp);
                  });
              }
          }
      }

      const combinedComponents: Component[] = userComponents.flatMap(userComp => {
          const masterComp = masterComponentsMap.get(userComp.master_component_id);
          if (!masterComp) return [];
          return [{
              ...userComp,
              componentName: masterComp.name,
              brand: masterComp.brand,
              model: masterComp.model,
              series: masterComp.series,
              componentGroup: masterComp.system,
              id: userComp.id,
              purchaseDate: toDate(userComp.purchase_date),
              lastServiceDate: toNullableDate(userComp.last_service_date),
          }];
      });
      
      setComponents(combinedComponents);

    } catch (error) {
      console.error("Error fetching equipment details: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load equipment details." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  

  useEffect(() => {
    const equipmentId = params.id as string;
    if (user && clientId && equipmentId) {
        fetchEquipmentAndComponents(clientId, equipmentId);
    } else if (!authLoading) {
        if (!clientId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Client user ID is missing.'});
        }
        setIsLoading(false);
    }
  }, [user, clientId, params.id, authLoading, fetchEquipmentAndComponents, toast]);

  const filteredComponents = useMemo(() => {
    if (!components || components.length === 0) {
        return [];
    }
    const systemSlug = params.system.replace(/-/g, ' ').toLowerCase();

    return components.filter(c => {
        const componentGroup = c.componentGroup ? c.componentGroup.toLowerCase() : '';
        
        if (systemSlug === 'brakes') {
            return componentGroup.includes('brake');
        }
        
        return componentGroup === systemSlug;
    });
  }, [components, params.system]);


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
      <div className="flex flex-col items-center justify-center h-full">
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
       <div className="flex items-center justify-between gap-2 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/equipment/${equipment.id}?userId=${clientId}`}>
              <ChevronLeft className="h-4 w-4" />
              Back to {equipment.name}
            </Link>
          </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="capitalize font-headline text-primary">{systemName} Components</CardTitle>
          <CardDescription>
            Viewing components for {equipment.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredComponents.length > 0 ? (
            filteredComponents.map(component => (
              <Link href={`/dashboard/equipment/${params.id}/${params.system}/${component.id}?userId=${clientId}`} key={component.id} className="block">
                <Card className="h-full flex flex-col hover:bg-muted/50 cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">{component.componentName}</CardTitle>
                    <CardDescription>{component.brand} {component.model}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                      <ComponentStatusList components={[component]} />
                  </CardContent>
                   <div className="p-4 pt-0 text-right">
                      <Button variant="link" className="p-0 h-auto">View Details <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
             <div className="text-center py-10 border-2 border-dashed rounded-lg col-span-full">
                <h3 className="text-lg font-semibold">No Components</h3>
                <p className="text-muted-foreground">No components found for the {systemName} system.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
