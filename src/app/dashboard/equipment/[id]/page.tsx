'use client'
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Bike,
  ChevronLeft,
  Footprints,
  Puzzle,
  Wrench,
  PlusCircle,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { loadCustomerBike } from '@/lib/bike-data';
import { getAccessToken } from '@/lib/client-auth';
import { addMaintenanceLogAction } from '@/app/dashboard/equipment/admin-actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ComponentStatusList } from '@/components/component-status-list';
import { MaintenanceLog } from '@/components/maintenance-log';
import type { Equipment, MaintenanceLog as MaintenanceLogType, Component, MasterComponent, UserComponent } from '@/lib/types';
import { AccessoriesIcon } from '@/components/icons/accessories-icon';
import { WheelsetIcon } from '@/components/icons/wheelset-icon';
import { RimBrakeIcon } from '@/components/icons/rim-brake-icon';
import { FramesetIcon } from '@/components/icons/frameset-icon';
import { DrivetrainIcon } from '@/components/icons/drivetrain-icon';
import { DiscBrakeIcon } from '@/components/icons/disc-brake-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { toDate, toNullableDate, formatDate } from '@/lib/date-utils';
import { EBIKE_TYPES } from '@/lib/constants';
import { CockpitIcon } from '@/components/icons/cockpit-icon';
import { AddWheelsetDialog } from '@/components/add-wheelset-dialog';

function ComponentIcon({ componentName, className }: { componentName: string, className?: string }) {
    const name = componentName.toLowerCase();
    
    if (name.includes('accessories')) {
        return <AccessoriesIcon className={className} />;
    }
    if (name.includes('frame')) {
        return <FramesetIcon className={className} />;
    }
    if (name.includes('disc brake')) {
        return <DiscBrakeIcon className={className} />;
    }
    if (name.includes('rim brake')) {
        return <RimBrakeIcon className={className} />;
    }
    if (name.includes('brake')) {
        return <DiscBrakeIcon className={className} />;
    }
    if (name.includes('wheel')) {
        return <WheelsetIcon className={className} />;
    }
    if (name.includes('cockpit')) {
        return <CockpitIcon className={className} />;
    }
    if (name.includes('drivetrain')) {
      return <DrivetrainIcon className={className} />;
    }
    if (name.includes('e-bike')) {
      return <Zap className={className} />;
    }
    // Default icon
    return <Puzzle className={className} />;
}

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, shopName } = useAuth();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment | undefined>();
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clientId = searchParams.get('userId');

  const fetchEquipment = useCallback(async (_clientId: string) => {
    setIsLoading(true);
    try {
      const { equipment: bike, ownerBikes } = await loadCustomerBike(params.id as string);
      setAllEquipment(ownerBikes);
      if (bike) {
        setEquipment(bike);
      } else {
        toast({ variant: "destructive", title: "Not Found", description: "Could not find the requested equipment." });
        setEquipment(undefined);
      }
    } catch (error) {
      console.error("Error fetching equipment details: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load equipment details." });
    } finally {
      setIsLoading(false);
    }
  }, [toast, params.id]);
  
  useEffect(() => {
    // We need the shop user to be loaded, and the clientId from the URL
    if (user && clientId) {
        fetchEquipment(clientId);
    } else if (!authLoading) {
        // Handle cases where there's no user or no clientId
        if (!clientId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Client user ID is missing.'});
        }
        setIsLoading(false);
    }
  }, [user, clientId, authLoading, fetchEquipment, toast]);
  

  const handleAddLog = async (newLog: Omit<MaintenanceLogType, 'id' | 'shopId' | 'shopName'>) => {
    if (!equipment) return;
    try {
      // Shops can't write to a customer's bike directly; this goes through a
      // server action that requires an open work order.
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
      await fetchEquipment(clientId ?? '');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not add log entry', description: error.message });
    }
  }

  const systemsToDisplay = useMemo(() => {
    const baseSystems = [
        'Drivetrain', 'Brakes', 'Frameset', 
        'Wheelset', 'Cockpit', 'Accessories'
    ];
    if (equipment && EBIKE_TYPES.includes(equipment.type as any)) {
        return [...baseSystems, 'E-Bike'];
    }
    return baseSystems;
  }, [equipment]);

  const associatedShoes = useMemo(() => {
    if (!equipment || equipment.type === 'Cycling Shoes') return [];
    return allEquipment.filter(e => 
      e.type === 'Cycling Shoes' && 
      e.associatedEquipmentIds?.includes(equipment.id)
    );
  }, [allEquipment, equipment]);

  if (isLoading || authLoading) {
      return <div><Skeleton className="h-96 w-full" /></div>
  }

  if (!equipment) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Equipment not found</h1>
          <p className="text-muted-foreground">The requested equipment could not be loaded or you may not have permission to view it.</p>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">
             <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  const topComponents = [...equipment.components]
    .sort((a, b) => (b.wearPercentage || 0) - (a.wearPercentage || 0))
    .slice(0, 3);

  const Icon = equipment.type.includes('Shoes') ? Footprints : Bike;
  const isShoes = equipment.type === 'Cycling Shoes';

  const MainLayout = (
     <>
        <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ChevronLeft className="h-4 w-4" />
                Back
            </Button>
        </div>
        <Card>
            <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl font-headline flex items-center gap-2">
                        <Icon className="h-7 w-7" />
                        {equipment.name}
                    </CardTitle>
                    <CardDescription>
                      <span>{equipment.brand} {equipment.model}{isShoes ? ` - ${equipment.size}` : (equipment.frameSize && ` - ${equipment.frameSize}`)}</span>
                      <span className="block">{equipment.type}</span>
                    </CardDescription>
                </div>
            </div>
            </CardHeader>
            <CardContent>
                <ComponentStatusList components={topComponents} />
            </CardContent>
        </Card>
        <div className="grid gap-4 mt-4 grid-cols-1 sm:grid-cols-2">
            <Card>
                <CardContent className="grid grid-cols-2 text-center pt-6">
                    <div>
                        <p className="text-3xl md:text-4xl font-headline">
                            {(equipment.totalDistance || 0).toFixed(2)}
                            <span className="text-lg md:text-xl font-normal text-muted-foreground"> km</span>
                        </p>
                        <p className="text-xs text-muted-foreground">Total Distance</p>
                    </div>
                    <div>
                        <p className="text-3xl md:text-4xl font-headline">
                            {(equipment.totalHours || 0).toFixed(2)}
                            <span className="text-lg md:text-xl font-normal text-muted-foreground"> hrs</span>
                        </p>
                        <p className="text-xs text-muted-foreground">Total Time</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="grid grid-cols-2 text-center pt-6">
                    <div>
                        <p className="text-xl md:text-2xl font-headline pt-2">
                            {formatDate(equipment.purchaseDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">Purchased</p>
                    </div>
                    <div>
                        <p className="text-xl md:text-2xl font-headline pt-2">
                            ${equipment.purchasePrice?.toLocaleString() || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">Price</p>
                    </div>
                </CardContent>
            </Card>
        </div>
     </>
  )

  if (isShoes) {
      return (
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2 p-4 sm:p-6">
              {MainLayout}
          </div>
      )
  }

  return (
    <div className="p-4 sm:p-6">
        <div className="grid items-start gap-4 md:gap-8 lg:grid-cols-3">
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
            {MainLayout}
            
            <Card>
              <CardHeader className='flex-row items-center justify-between'>
                <CardTitle>Systems</CardTitle>
                  {clientId && (
                    <AddWheelsetDialog equipment={equipment} onSuccess={() => fetchEquipment(clientId)}>
                        <Button variant="outline" size="sm">
                        <PlusCircle className='mr-2 h-4 w-4' />
                        Add Wheelset
                        </Button>
                    </AddWheelsetDialog>
                  )}
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {systemsToDisplay.map(systemName => (
                    <Link href={`/dashboard/equipment/${equipment.id}/${systemName.toLowerCase().replace(/\s+/g, '-')}?userId=${clientId}`} key={systemName}>
                       <Card className="hover:bg-muted/50 cursor-pointer transition-colors h-full">
                          <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6 gap-2">
                            <ComponentIcon componentName={systemName} className="h-[40px] w-[40px] text-muted-foreground" />
                            <h4 className="text-sm font-headline font-bold uppercase text-center tracking-wider">{systemName}</h4>
                          </CardContent>
                        </Card>
                    </Link>
                  ))}
              </CardContent>
            </Card>
            
            <MaintenanceLog log={equipment.maintenanceLog} onAddLog={handleAddLog} />

          </div>
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-1">
             {associatedShoes.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Footprints />
                            Associated Shoes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        <ul className="list-disc pl-5 text-sm">
                            {associatedShoes.map(shoe => (
                                <li key={shoe.id}>{shoe.name}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
          </div>
        </div>
    </div>
  );
}
