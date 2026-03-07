import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Download, Upload, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ConsultantsRegistry() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    category: "",
    contactPerson: "",
    mobileNumber: "",
    emailAddress: "",
    website: "",
    status: "quoted_only" as const,
    notes: "",
  });

  // Queries
  const { data: consultants = [], isLoading, refetch } = trpc.consultantsRegistry.getAll.useQuery({
    search,
    category: selectedCategory === "all" ? undefined : selectedCategory,
    status: selectedStatus === "all" ? undefined : selectedStatus,
  });

  const { data: categories = [] } = trpc.consultantsRegistry.getCategories.useQuery();

  // Mutations
  const createMutation = trpc.consultantsRegistry.create.useMutation({
    onSuccess: () => {
      toast({ title: "Success", description: "Consultant added successfully" });
      setIsAddOpen(false);
      setFormData({
        companyName: "",
        category: "",
        contactPerson: "",
        mobileNumber: "",
        emailAddress: "",
        website: "",
        status: "quoted_only",
        notes: "",
      });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.consultantsRegistry.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Success", description: "Consultant deleted" });
      refetch();
    },
  });

  const handleAddConsultant = async () => {
    if (!formData.companyName || !formData.category) {
      toast({ title: "Error", description: "Company name and category are required", variant: "destructive" });
      return;
    }
    await createMutation.mutateAsync(formData);
  };

  const statusColors: Record<string, string> = {
    quoted_only: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    appointed: "bg-green-100 text-green-800",
    not_selected: "bg-red-100 text-red-800",
  };

  const statusLabels: Record<string, string> = {
    quoted_only: "Quoted Only",
    under_review: "Under Review",
    appointed: "Appointed",
    not_selected: "Not Selected",
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Consultants & Technical Specialists Registry</h1>
          <p className="text-muted-foreground">Manage your external consultants and specialists</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Input
            placeholder="Search by company, contact, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:col-span-2"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="quoted_only">Quoted Only</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="appointed">Appointed</SelectItem>
              <SelectItem value="not_selected">Not Selected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add Button */}
        <div className="mb-6">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Consultant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Consultant</DialogTitle>
                <DialogDescription>Quick entry form - complete in under 1 minute</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Company Name *</label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g., ABC Architects"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Contact Person</label>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Mobile</label>
                  <Input
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="+971..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.emailAddress}
                    onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quoted_only">Quoted Only</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="appointed">Appointed</SelectItem>
                      <SelectItem value="not_selected">Not Selected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
                <Button onClick={handleAddConsultant} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Consultant
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Consultants List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : consultants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No consultants found</p>
              <Button onClick={() => setIsAddOpen(true)} variant="outline">
                Add your first consultant
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {consultants.map((consultant) => (
              <Card key={consultant.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{consultant.companyName}</CardTitle>
                      <CardDescription>{consultant.category}</CardDescription>
                    </div>
                    <Badge className={statusColors[consultant.status as keyof typeof statusColors]}>
                      {statusLabels[consultant.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {consultant.contactPerson && (
                    <div>
                      <p className="text-sm text-muted-foreground">Contact</p>
                      <p className="font-medium">{consultant.contactPerson}</p>
                    </div>
                  )}
                  {consultant.mobileNumber && (
                    <div>
                      <p className="text-sm text-muted-foreground">Mobile</p>
                      <p className="font-medium">{consultant.mobileNumber}</p>
                    </div>
                  )}
                  {consultant.emailAddress && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a href={`mailto:${consultant.emailAddress}`} className="text-blue-600 hover:underline">
                        {consultant.emailAddress}
                      </a>
                    </div>
                  )}
                  {consultant.website && (
                    <div>
                      <p className="text-sm text-muted-foreground">Website</p>
                      <a href={consultant.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        Visit <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {consultant.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm">{consultant.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ id: consultant.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
