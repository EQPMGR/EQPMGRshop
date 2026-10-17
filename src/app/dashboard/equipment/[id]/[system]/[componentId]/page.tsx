
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Wrench, Loader2, Replace } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { addMaintenanceLogAction } from '@/app/dashboard/equipment/admin-actions';
import { getAccessToken } from '@/lib/client-auth';
import { db } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { toDate, toNullableDate, formatDate } from '@/lib/date-utils';
import type { Component, MasterComponent, UserComponent, MaintenanceLog as MaintenanceLogType, Equipment } from '@/lib/types';
import { ComponentStatusList } from '@/components/component-status-list';
import { AddMaintenanceLogDialog } from '@/components/add-maintenance-log-dialog';
import { ReplaceComponentDialog } from '@/components/replace-component-dialog';


export default function ComponentDetailPage() {
  const params = useParams<{ id: string; system: string; componentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, shopName } = useAuth();
  const { toast } = useToast();
  const [component, setComponent] = useState<Component | undefined>();
  const [subComponents, setSubComponents] = useState<Component[]>([]);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const clientId = searchParams.get('userId');

  const fetchComponentData = useCallback(async (uid: string, equipmentId: string, userComponentId: string) => {
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
          toast({ variant: 'destructive', title: 'Equipment not found' });
          setIsLoading(false);
          return;
      }

      setEquipment({ 
          ...equipmentData,
          purchaseDate: toDate(equipmentData.purchase_date),
          maintenanceLog: (equipmentData.maintenance_log || []).map((l: any) => ({...l, date: toDate(l.date)})),
        } as Equipment);

      // Fetch main component
      const { data: mainComponentData, error: mainComponentError } = await db
        .from('components')
        .select('*')
        .eq('id', userComponentId)
        .eq('equipment_id', equipmentId)
        .eq('user_id', uid)
        .single();

      if (mainComponentError || !mainComponentData) {
          toast({ variant: 'destructive', title: 'Component not found' });
          setIsLoading(false);
          return;
      }

      const mainUserComp = mainComponentData as UserComponent;

      // Fetch sub-components
      const { data: subComponentsData, error: subComponentsError } = await db
        .from('components')
        .select('*')
        .eq('parent_user_component_id', userComponentId)
        .eq('equipment_id', equipmentId)
        .eq('user_id', uid);

      if (subComponentsError) throw subComponentsError;

      const subUserComps = (subComponentsData || []) as UserComponent[];

      const masterIdsToFetch = [
        mainUserComp.master_component_id,
        ...subUserComps.map(sc => sc.master_component_id)
      ].filter(Boolean);

      const uniqueMasterIds = [...new Set(masterIdsToFetch)];

      const masterCompsMap = new Map<string, MasterComponent>();
      if (uniqueMasterIds.length > 0) {
          for (let i = 0; i < uniqueMasterIds.length; i += 30) {
            const batchIds = uniqueMasterIds.slice(i, i + 30);
            if (batchIds.length > 0) {
                const { data: masterCompsData, error: masterError } = await db
                  .from('master_components')
                  .select('*')
                  .in('id', batchIds);

                if (masterError) throw masterError;

                (masterCompsData || []).forEach((masterComp: any) => {
                  masterCompsMap.set(masterComp.id, masterComp);
                });
            }
          }
      }

      const mainMasterComp = masterCompsMap.get(mainUserComp.master_component_id);
      if (mainMasterComp) {
        setComponent({
          ...mainUserComp,
          componentName: mainMasterComp.name,
          brand: mainMasterComp.brand,
          model: mainMasterComp.model,
          series: mainMasterComp.series,
          componentGroup: mainMasterComp.system,
          id: mainUserComp.id,
          purchaseDate: toDate(mainUserComp.purchase_date),
          lastServiceDate: toNullableDate(mainUserComp.last_service_date),
        });
      }

      const combinedSubComponents: Component[] = subUserComps.flatMap(subUserComp => {
        const masterComp = masterCompsMap.get(subUserComp.master_component_id);
        if (!masterComp) return [];
        return [{
          ...subUserComp,
          componentName: masterComp.name,
          brand: masterComp.brand,
          model: masterComp.model,
          series: masterComp.series,
          componentGroup: masterComp.system,
          id: subUserComp.id,
          purchaseDate: toDate(subUserComp.purchase_date),
          lastServiceDate: toNullableDate(subUserComp.last_service_date),
        }];
      });

      setSubComponents(combinedSubComponents);

    } catch (error) {
      console.error("Error fetching component details: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load component details." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && clientId && params.id && params.componentId) {
      fetchComponentData(clientId, params.id as string, params.componentId as string);
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, clientId, params.id, params.componentId, authLoading, toast, fetchComponentData]);

  const handleSuccess = () => {
      if (user && clientId && params.id && params.componentId) {
        fetchComponentData(clientId, params.id as string, params.componentId as string);
    }
  }
  
   const handleAddLog = async (newLog: Omit<MaintenanceLogType, 'id' | 'shopId' | 'shopName'>) => {
    if (!clientId || !equipment || !user || !shopName) return;
    // Shops can't write to a customer's bike directly; this goes through a
    // server action that requires an open work order.
    try {
      await addMaintenanceLogAction({
        accessToken: await getAccessToken(),
        equipmentId: equipment.id,
        entry: {
          date: toDate(newLog.date).toISOString(),
          componentName: newLog.componentName,
          serviceType: newLog.serviceType,
          notes: newLog.notes,
          cost: newLog.cost,
        },
      });
      handleSuccess(); // Re-fetch data
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not add log entry', description: error.message });
    }
  }


  if (isLoading || authLoading) {
      return (
        <div className="p-4 sm:p-6">
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      )
  }

  if (!component) {
    return (
      <div className="text-center p-4 sm:p-6">
        <h1 className="text-2xl font-bold">Component not found</h1>
        <Button asChild variant="link">
            <Link href={`/dashboard/equipment/${params.id}?userId=${clientId}`}>Go back to Equipment</Link>
        </Button>
      </div>
    );
  }
  

  return (
     <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/equipment/${params.id}/${params.system}?userId=${clientId}`}>
                  <ChevronLeft className="h-4 w-4" />
                  Back to System
              </Link>
          </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{component.componentName}</CardTitle>
          <CardDescription>{component.brand} {component.model}</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mt-4">
              <ComponentStatusList components={[component]} />
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t pt-6">
                <div>
                    <p className="text-muted-foreground">System</p>
                    <p className="font-medium capitalize">{component.componentGroup}</p>
                </div>
                 <div><p className="text-muted-foreground">Size</p><p className="font-medium">N/A</p></div>
                <div>
                    <p className="text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">{formatDate(component.purchaseDate ?? undefined)}</p>
                </div>
                 <div>
                    <p className="text-muted-foreground">Last Service</p>
                    <p className="font-medium">{formatDate(component.lastServiceDate ?? undefined)}</p>
                </div>
            </div>

            {subComponents.length > 0 && (
                 <div className="mt-6 border-t pt-6">
                    <h4 className="font-semibold mb-2">Attached Components</h4>
                    <div className="space-y-4">
                       {subComponents.map(sub => (
                         <Card key={sub.id} className="p-4 bg-muted/50">
                            <h5 className="font-medium">{sub.componentName}</h5>
                            <p className="text-sm text-muted-foreground">{sub.brand} {sub.model}</p>
                            <div className="mt-2">
                                <ComponentStatusList components={[sub]} />
                            </div>
                         </Card>
                       ))}
                    </div>
                </div>
            )}

             <div className="mt-6 border-t pt-6">
                <h4 className="font-semibold mb-2">Actions</h4>
                <div className="flex gap-2 flex-wrap">
                    {user && clientId && shopName && (
                        <ReplaceComponentDialog
                          equipmentId={params.id as string}
                          componentToReplace={component}
                          onSuccess={handleSuccess}
                        />
                    )}
                    <AddMaintenanceLogDialog onAddLog={handleAddLog}>
                        <Button variant="secondary">
                            <Wrench className="mr-2 h-4 w-4" />
                            Log Maintenance
                        </Button>
                    </AddMaintenanceLogDialog>
                </div>
             </div>
        </CardContent>
      </Card>
     </div>
  );
}
