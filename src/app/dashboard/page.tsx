
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, DocumentData, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { WorkOrder, WorkOrderStatus, allStatuses, statusVariant } from '@/app/dashboard/work-orders/page';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { WorkOrderDetailSheet } from '@/components/work-order-detail-sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';


type Availability = "Today" | "2-3 Day Wait" | "One Week Wait" | "Not Taking Orders";

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [availability, setAvailability] = useState<Availability | undefined>();
  const [dropOff, setDropOff] = useState(false);
  const [valetService, setValetService] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasStripeId, setHasStripeId] = useState(false);
  
  const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(true);

  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchShopSettings = async () => {
        setLoading(true);
        const serviceProviderRef = doc(db, "serviceProviders", user.uid);
        const docSnap = await getDoc(serviceProviderRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAvailability(data.availability || 'Today');
          setDropOff(data.dropOff || false);
          setValetService(data.valetService || false);
          setHasStripeId(!!data.stripeCustomerId);
        }
        setLoading(false);
    };
    fetchShopSettings();
  }, [user]);

   useEffect(() => {
    if (!user) return;

    setWorkOrdersLoading(true);
    
    const recentWorkOrdersQuery = query(
        collection(db, "workOrders"), 
        where("serviceProviderId", "==", user.uid),
        limit(5)
    );
    
    const unsubscribeRecent = onSnapshot(recentWorkOrdersQuery, (querySnapshot) => {
      const orders: WorkOrder[] = [];
      querySnapshot.forEach((doc: DocumentData) => {
        const data = doc.data();
        
        let status: WorkOrderStatus = 'New';
        if (allStatuses.includes(data.status)) {
            status = data.status;
        } else if (data.status === 'pending') {
            status = 'New';
        }

        orders.push({
          id: doc.id,
          customerName: data.userName || 'N/A',
          bike: data.equipmentBrand && data.equipmentModel ? `${data.equipmentBrand} ${data.equipmentModel}` : 'N/A',
          issueDescription: data.serviceType || 'No description',
          createdAt: data.createdAt?.toDate().toLocaleDateString() || 'N/A',
          status: status,
          userEmail: data.userEmail || '',
          userPhone: data.userPhone || '',
          notes: data.notes || '',
          equipmentName: data.equipmentName || '',
          userId: data.userId || '',
          equipmentId: data.equipmentId || '',
        });
      });
      const sortedOrders = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentWorkOrders(sortedOrders);
      setWorkOrdersLoading(false);
    }, (error) => {
        console.error("Error fetching recent work orders: ", error);
        toast({ title: "Error", description: "Could not fetch recent work orders.", variant: "destructive" });
        setWorkOrdersLoading(false);
    });

    return () => {
        unsubscribeRecent();
    };
  }, [user, toast]);


  const handleSaveChanges = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const serviceProviderRef = doc(db, "serviceProviders", user.uid);
      await updateDoc(serviceProviderRef, {
        availability,
        dropOff,
        valetService,
      });
      toast({ title: "Success", description: "Availability settings saved." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetails = (order: WorkOrder) => {
    setSelectedWorkOrder(order);
    setIsSheetOpen(true);
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <h1 className="text-3xl font-headline font-bold text-primary">Dashboard</h1>
             {loading ? <Skeleton className="h-6 w-32" /> : (
                hasStripeId ? (
                <div className="flex items-center gap-2 text-sm text-green-400">
                    <ShieldCheck className="h-5 w-5" />
                    <span>Billing Active</span>
                </div>
            ) : null
            )}
        </div>

      {!loading && !hasStripeId && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required: Complete Billing Setup</AlertTitle>
            <AlertDescription>
                Your shop is not yet active. Please go to <Link href="/dashboard/settings" className="font-semibold underline hover:text-white">Settings</Link> to set up your payment method via Stripe. You will not be able to receive work orders until this is complete.
            </AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        <div className="lg:col-span-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Recent Work Orders</CardTitle>
                    <CardDescription>A list of your 5 most recent work orders. Click one to see details.</CardDescription>
                </CardHeader>
                <CardContent>
                {workOrdersLoading ? (
                    <div className="flex items-center justify-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : recentWorkOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent work orders found.</p>
                ) : (
                    <div className="space-y-2">
                    {recentWorkOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => handleViewDetails(order)}
                          className="flex items-center justify-between w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                          disabled={order.status === 'Completed'}
                        >
                        <div className="flex items-center gap-4">
                            <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-muted sm:flex">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="grid gap-1">
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">{order.bike} - {order.issueDescription}</p>
                            </div>
                        </div>
                        <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                        </button>
                    ))}
                    <div className="pt-2">
                        <Button asChild size="sm" variant="link" className="px-0">
                        <Link href="/dashboard/work-orders">View all work orders</Link>
                        </Button>
                    </div>
                    </div>
                )}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Upcoming Appointments</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Appointments list coming soon...</p>
                </CardContent>
            </Card>
        </div>


        <div className="lg:col-span-3">
            <Card>
                <CardHeader>
                <CardTitle>Availability Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                {loading ? (
                    <div className="flex items-center justify-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                    <div className="space-y-4">
                        <div>
                        <Label className="font-medium">Current Wait Time</Label>
                        <RadioGroup value={availability} onValueChange={(value: Availability) => setAvailability(value)} className="mt-2 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
                            <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Today" id="today" />
                            <Label htmlFor="today">Today</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                            <RadioGroupItem value="2-3 Day Wait" id="2-3-day" />
                            <Label htmlFor="2-3-day">2-3 Day Wait</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                            <RadioGroupItem value="One Week Wait" id="one-week" />
                            <Label htmlFor="one-week">One Week Wait</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Not Taking Orders" id="not-taking" />
                            <Label htmlFor="not-taking">Not Taking Orders</Label>
                            </div>
                        </RadioGroup>
                        </div>

                        <div>
                        <Label className="font-medium">Service Options</Label>
                        <div className="mt-2 flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="drop-off" checked={dropOff} onCheckedChange={(checked) => setDropOff(Boolean(checked))} />
                                <Label htmlFor="drop-off">Drop-Off Service</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="valet" checked={valetService} onCheckedChange={(checked) => setValetService(Boolean(checked))} />
                                <Label htmlFor="valet">Valet Service</Label>
                            </div>
                        </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveChanges} className="bg-accent hover:bg-accent/90" disabled={saving}>
                        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                        </Button>
                    </div>
                    </>
                )}
                </CardContent>
            </Card>
        </div>
      </div>

       {selectedWorkOrder && (
        <WorkOrderDetailSheet
            isOpen={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            workOrder={selectedWorkOrder}
        />
      )}
    </div>
  );
}
