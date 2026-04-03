import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, FileUp, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function BusinessPartnersRegistry() {
  const [, navigate] = useLocation();
  const [partners, setPartners] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    category: "",
    contactPerson: "",
    mobileNumber: "",
    emailAddress: "",
    website: "",
    status: "quoted_only",
    notes: "",
  });

  const handleAddPartner = () => {
    setEditingId(null);
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
    setIsDialogOpen(true);
  };

  const handleEditPartner = (partner: any) => {
    setEditingId(partner.id);
    setFormData(partner);
    setIsDialogOpen(true);
  };

  const handleSavePartner = () => {
    if (!formData.companyName.trim()) {
      alert("Company name is required");
      return;
    }

    if (editingId) {
      setPartners(partners.map(p => p.id === editingId ? { ...formData, id: editingId } : p));
    } else {
      setPartners([...partners, { ...formData, id: Date.now() }]);
    }

    setIsDialogOpen(false);
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
  };

  const handleDeletePartner = (id: number) => {
    if (confirm("Are you sure you want to delete this partner?")) {
      setPartners(partners.filter(p => p.id !== id));
    }
  };

  const statusLabels: Record<string, string> = {
    quoted_only: "Quoted Only",
    under_review: "Under Review",
    appointed: "Appointed",
    not_selected: "Not Selected",
  };

  const statusColors: Record<string, string> = {
    quoted_only: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    appointed: "bg-green-100 text-green-800",
    not_selected: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20" dir="ltr">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-lg font-bold text-foreground">Business Partners & Vendors Registry</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Add Partner Button */}
        <div className="mb-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddPartner} className="gap-2">
                <Plus className="w-4 h-4" />
                Add New Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Partner" : "Add New Partner"}
                </DialogTitle>
                <DialogDescription>
                  Enter the partner's information below
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>

                {/* Category */}
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Consultant, Contractor, Supplier"
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Enter contact person name"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <Label htmlFor="mobileNumber">Mobile Number</Label>
                  <Input
                    id="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="Enter mobile number"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={formData.emailAddress}
                    onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>

                {/* Website */}
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="Enter website URL"
                  />
                </div>

                {/* Status */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger id="status">
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

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter additional notes"
                    rows={3}
                  />
                </div>

                {/* Save Button */}
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePartner}>
                    {editingId ? "Update Partner" : "Add Partner"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Partners Grid */}
        {partners.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <p className="text-muted-foreground mb-4">No partners added yet</p>
              <Button onClick={handleAddPartner} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add First Partner
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {partners.map((partner) => (
              <Card key={partner.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{partner.companyName}</CardTitle>
                      <CardDescription>{partner.category}</CardDescription>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[partner.status]}`}>
                      {statusLabels[partner.status]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {partner.contactPerson && (
                      <div>
                        <p className="text-xs text-muted-foreground">Contact Person</p>
                        <p className="font-medium">{partner.contactPerson}</p>
                      </div>
                    )}
                    {partner.mobileNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground">Mobile</p>
                        <p className="font-medium">{partner.mobileNumber}</p>
                      </div>
                    )}
                    {partner.emailAddress && (
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-sm break-all">{partner.emailAddress}</p>
                      </div>
                    )}
                    {partner.website && (
                      <div>
                        <p className="text-xs text-muted-foreground">Website</p>
                        <a href={partner.website} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-blue-600 hover:underline break-all">
                          {partner.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {partner.notes && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{partner.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPartner(partner)}
                      className="gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeletePartner(partner.id)}
                      className="gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
