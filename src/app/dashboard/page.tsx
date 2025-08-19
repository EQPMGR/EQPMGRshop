
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
import { Wrench, CheckCircle, DollarSign, Users, Loader2, Dot } from "lucide-react";
import { WorkOrder, WorkOrderStatus, allStatuses, statusVariant } from '@/app/dashboard/work-orders/page';
import { Employee } from '@/app/dashboard/employees/page';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';


type Availability = "Today" | "2-3 Day Wait" | "One Week Wait" | "Not Taking Orders";

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [availability, setAvailability] = useState<Availability | undefined>();
  const [dropOff, setDropOff] = useState(false);
  const [valetService, setValetService] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(true);

  const [openWorkOrdersCount, setOpenWorkOrdersCount] = useState(0);
  const [teamMembersCount, setTeamMembersCount] = useState(0);

  const stats = [
    { title: "Open Work Orders", value: openWorkOrdersCount.toString(), icon: Wrench, color: "text-accent" },
    { title: "Completed This Month", value: "47", icon: CheckCircle, color: "text-green-500" },
    { title: "Revenue (MTD)", value: "$8,230", icon: DollarSign, color: "text-blue-500" },
    { title: "Team Members", value: teamMembersCount.toString(), icon: Users, color: "text-purple-500" },
  ];

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
        }
        setLoading(false);
    };
    fetchShopSettings();
  }, [user]);

   useEffect(() => {
    if (!user) return;

    setWorkOrdersLoading(true);
    
    // This query fetches all work orders to calculate stats.
    const allWorkOrdersQuery = query(
        collection(db, "workOrders"), 
        where("serviceProviderId", "==", user.uid)
    );

    const unsubscribeAll = onSnapshot(allWorkOrdersQuery, (querySnapshot) => {
        const openOrders = querySnapshot.docs.filter(doc => doc.data().status !== 'Completed').length;
        setOpenWorkOrdersCount(openOrders);
    }, (error) => {
        console.error("Error fetching all work orders for stats: ", error);
        // Optionally show a toast or error message
    });


    // This query fetches the 5 most recent for the list display.
    const recentWorkOrdersQuery = query(
        collection(db, "workOrders"), 
        where("serviceProviderId", "==", user.uid),
        // orderBy("createdAt", "desc"), // This causes an index error. We will sort on the client.
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
        });
      });
      // Sort client-side to avoid index requirement
      const sortedOrders = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentWorkOrders(sortedOrders);
      setWorkOrdersLoading(false);
    }, (error) => {
        console.error("Error fetching recent work orders: ", error);
        toast({ title: "Error", description: "Could not fetch recent work orders.", variant: "destructive" });
        setWorkOrdersLoading(false);
    });

    // Fetch employees for team member count
     const employeesQuery = query(collection(db, 'employees'), where('shopId', '==', user.uid));
     const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
        setTeamMembersCount(snapshot.size);
     }, (error) => {
        console.error("Error fetching employees: ", error);
        // Optionally show a toast or error message
     });


    return () => {
        unsubscribeAll();
        unsubscribeRecent();
        unsubscribeEmployees();
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold text-primary">Dashboard</h1>
      
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
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {/* <p className="text-xs text-muted-foreground">+2 from last month</p> */}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Recent Work Orders</CardTitle>
                <CardDescription>A list of your 5 most recent work orders.</CardDescription>
            </CardHeader>
            <CardContent>
               {workOrdersLoading ? (
                 <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
               ) : recentWorkOrders.length === 0 ? (
                 <p className="text-sm text-muted-foreground">No recent work orders found.</p>
               ) : (
                <div className="space-y-4">
                  {recentWorkOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between">
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
                    </div>
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
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Upcoming Appointments</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Appointments list coming soon...</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
