
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Bike,
  ChevronLeft,
  Footprints,
  Puzzle,
  Shield,
  Pencil,
  Trash2,
  Loader2,
  Zap,
  Wrench,
  PlusCircle,
} from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ComponentStatusList } from '@/components/component-status-list';
import { MaintenanceLog } from '@/components/maintenance-log';
import { WearSimulation } from '@/components/wear-simulation';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';
import type { Equipment, MaintenanceLog as MaintenanceLogType, Component, MasterComponent, UserComponent } from '@/lib/types';
import { AccessoriesIcon } from '@/components/icons/accessories-icon';
import { WheelsetIcon } from '@/components/icons/wheelset-icon';
import { RimBrakeIcon } from '@/components/icons/rim-brake-icon';
import { FramesetIcon } from '@/components/icons/frameset-icon';
import { FitInfoIcon } from '@/components/icons/fit-info-icon';
import { DrivetrainIcon } from '@/components/icons/drivetrain-icon';
import { DiscBrakeIcon } from '@/components/icons/disc-brake-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { EditEquipmentDialog } from '@/components/edit-equipment-dialog';
import { toDate, toNullableDate, formatDate } from '@/lib/date-utils';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { BikeFitDialog } from '@/components/bike-fit-dialog';
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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment | undefined>();
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const clientId = searchParams.get('userId');

  const fetchEquipment = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // Fetch all equipment to pass to dialogs
      const allEquipmentQuery = query(collection(db, 'users', uid, 'equipment'));
      const allEquipmentSnapshot = await getDocs(allEquipmentQuery);
      const allEq = allEquipmentSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Equipment);
      setAllEquipment(allEq);

      // Fetch the specific equipment for this page
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
                console.warn(`Master component with ID ${userComp.masterComponentId} not found.`);
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
            purchaseDate: toDate(equipmentData.purchaseDate),
            components: combinedComponents,
            maintenanceLog: (equipmentData.maintenanceLog || []).map((l: any) => ({
                ...l,
                date: toDate(l.date),
            })),
        } as Equipment);
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
  
  const handleUpdateEquipment = async (data: Partial<Equipment>) => {
    if (!clientId || !equipment) {
      toast({ variant: "destructive", title: "Error", description: "Could not update equipment." });
      return;
    }
    
    const equipmentDocRef = doc(db, 'users', clientId, 'equipment', equipment.id);
    await updateDoc(equipmentDocRef, data);
    
    await fetchEquipment(clientId);
  };

  const handleDeleteEquipment = async () => {
    if (!clientId || !equipment) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete equipment." });
      return;
    }
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      const componentsRef = collection(db, 'users', clientId, 'equipment', equipment.id, 'components');
      const componentsSnap = await getDocs(componentsRef);
      componentsSnap.forEach(doc => batch.delete(doc.ref));

      const equipmentDocRef = doc(db, 'users', clientId, 'equipment', equipment.id);
      batch.delete(equipmentDocRef);

      await batch.commit();

      toast({
        title: "Success!",
        description: "Equipment has been deleted."
      });

      router.back();
    } catch (error) {
      console.error("Error deleting equipment: ", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "An error occurred while deleting the equipment."
      });
      setIsDeleting(false);
    }
  };

  const handleAddLog = async (newLog: Omit<MaintenanceLogType, 'id'>) => {
    if (!clientId || !equipment) return;
    const logWithId = { ...newLog, id: crypto.randomUUID() };
    const updatedLog = [...equipment.maintenanceLog, logWithId];
    
    const equipmentDocRef = doc(db, 'users', clientId, 'equipment', equipment.id);
    await updateDoc(equipmentDocRef, {
      maintenanceLog: updatedLog.map(l => ({...l, date: toDate(l.date)})),
    });

    setEquipment(prev => prev ? ({ ...prev, maintenanceLog: updatedLog.map(l => ({...l, date: toDate(l.date)})) }) : undefined);
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
    .sort((a, b) => b.wearPercentage - a.wearPercentage)
    .slice(0, 3);

  const Icon = equipment.type.includes('Shoes') ? Footprints : Bike;
  const isShoes = equipment.type === 'Cycling Shoes';
  const allBikes = allEquipment.filter(e => e.type !== 'Cycling Shoes');

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
                <div className="flex items-center gap-2">
                     <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit Equipment</span>
                            </Button>
                        </DialogTrigger>
                        <EditEquipmentDialog 
                            equipment={equipment} 
                            allBikes={allBikes}
                            onUpdateEquipment={handleUpdateEquipment}
                        />
                    </Dialog>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete Equipment</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your
                                equipment and all of its associated data.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteEquipment} disabled={isDeleting}>
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
                            {equipment.totalDistance.toFixed(2)}
                            <span className="text-lg md:text-xl font-normal text-muted-foreground"> km</span>
                        </p>
                        <p className="text-xs text-muted-foreground">Total Distance</p>
                    </div>
                    <div>
                        <p className="text-3xl md:text-4xl font-headline">
                            {equipment.totalHours.toFixed(2)}
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
                            {formatDate(equipment.purchaseDate, user?.dateFormat)}
                        </p>
                        <p className="text-xs text-muted-foreground">Purchased</p>
                    </div>
                    <div>
                        <p className="text-xl md:text-2xl font-headline pt-2">
                            ${equipment.purchasePrice?.toLocaleString()}
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
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
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
                    <div key={systemName} className="hover:bg-muted/50 cursor-pointer transition-colors h-full">
                       <Card className="h-full">
                          <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6 gap-2">
                            <ComponentIcon componentName={systemName} className="h-[40px] w-[40px] text-muted-foreground" />
                            <h4 className="text-sm font-headline font-bold uppercase text-center tracking-wider">{systemName}</h4>
                          </CardContent>
                        </Card>
                    </div>
                  ))}
              </CardContent>
            </Card>
            
            <MaintenanceLog log={equipment.maintenanceLog} onAddLog={handleAddLog} />
            <WearSimulation equipment={equipment} onSuccess={() => fetchEquipment(clientId!)} />
            <MaintenanceSchedule equipment={equipment} />
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
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Wrench />
                      Service & Support
                  </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button>Request Service</Button>
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FitInfoIcon className="h-5 w-5" />
                        Bike Fit
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                   <BikeFitDialog equipment={equipment} userId={clientId!} onSuccess={() => fetchEquipment(clientId!)}>
                        <Button>Enter Fit Details</Button>
                   </BikeFitDialog>
                   <Button variant="secondary">Book a Bike Fitting</Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield />
                        Protect Your Gear
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                    <Button asChild>
                        <Link href="https://project529.com/garage" target="_blank" rel="noopener noreferrer">
                            Register with Project 529
                        </Link>
                    </Button>
                    <Button asChild variant="secondary">
                        <Link href="#" target="_blank" rel="noopener noreferrer">
                            Get Insurance Quote
                        </Link>
                    </Button>
                </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
