import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, UserCircle, Phone, MapPin, Award, Users, Building,
  Mail, Edit3, Save, X, Briefcase, Hash, Plus, Trash2
} from "lucide-react";

export default function ConsultantKnowPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [newConsultantName, setNewConsultantName] = useState("");

  const utils = trpc.useUtils();
  const consultantsQuery = trpc.consultants.list.useQuery();
  const detailsQuery = trpc.consultantDetails.getAll.useQuery();

  const createMutation = trpc.consultants.create.useMutation({
    onSuccess: () => {
      utils.consultants.list.invalidate();
      setNewConsultantName("");
      toast.success("تمت إضافة الاستشاري بنجاح");
    },
    onError: () => toast.error("حدث خطأ في الإضافة"),
  });

  const deleteMutation = trpc.consultants.delete.useMutation({
    onSuccess: () => {
      utils.consultants.list.invalidate();
      toast.success("تم حذف الاستشاري بنجاح");
    },
    onError: () => toast.error("حدث خطأ في الحذف"),
  });

  const upsertMutation = trpc.consultantDetails.upsert.useMutation({
    onSuccess: () => {
      detailsQuery.refetch();
      toast.success("تم حفظ البيانات بنجاح");
      setEditingId(null);
    },
    onError: () => toast.error("حدث خطأ في الحفظ"),
  });

  const consultants = consultantsQuery.data || [];
  const details = detailsQuery.data || [];

  const getDetail = (consultantId: number) => details.find((d: any) => d.consultantId === consultantId);

  const startEdit = (consultantId: number) => {
    const detail = getDetail(consultantId);
    setEditData({
      phone2: detail?.phone2 || "",
      location: detail?.location || "",
      classification: detail?.classification || "",
      weight: detail?.weight || "",
      yearsOfExperience: detail?.yearsOfExperience || 0,
      numberOfEngineers: detail?.numberOfEngineers || 0,
      notableClients: detail?.notableClients || "",
      contactPerson: detail?.contactPerson || "",
      contactPersonPhone: detail?.contactPersonPhone || "",
      contactPersonEmail: detail?.contactPersonEmail || "",
    });
    setEditingId(consultantId);
  };

  const saveEdit = (consultantId: number) => {
    upsertMutation.mutate({
      consultantId,
      ...editData,
      yearsOfExperience: parseInt(editData.yearsOfExperience) || 0,
      numberOfEngineers: parseInt(editData.numberOfEngineers) || 0,
    });
  };

  const handleAddConsultant = () => {
    const name = newConsultantName.trim();
    if (!name) {
      toast.error("يرجى إدخال اسم الاستشاري");
      return;
    }
    createMutation.mutate({ name });
  };

  const handleDeleteConsultant = (id: number, name: string) => {
    if (confirm(`هل أنت متأكد من حذف "${name}" من القائمة الرئيسية؟`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <Link href="/consultant-portal" className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            العودة لمكاتب الاستشارات
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
              <UserCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">تعرف على الاستشاري</h1>
              <p className="text-stone-400 text-sm">معلومات شاملة عن كل مكتب استشاري</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* إدارة القائمة الرئيسية للاستشاريين */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            إدارة القائمة الرئيسية للاستشاريين
          </h2>

          {/* إضافة استشاري جديد */}
          <div className="flex gap-3 mb-5">
            <Input
              value={newConsultantName}
              onChange={(e) => setNewConsultantName(e.target.value)}
              placeholder="اسم الاستشاري الجديد"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddConsultant()}
            />
            <Button
              onClick={handleAddConsultant}
              disabled={createMutation.isPending}
              className="gap-1 bg-violet-600 hover:bg-violet-700 shrink-0"
            >
              <Plus className="w-4 h-4" />
              إضافة استشاري
            </Button>
          </div>

          {/* قائمة الاستشاريين الحالية */}
          <div className="flex flex-wrap gap-2">
            {consultants.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-stone-800">{c.name}</span>
                <button
                  onClick={() => handleDeleteConsultant(c.id, c.name)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                  title="حذف الاستشاري"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {consultants.length === 0 && (
              <p className="text-stone-400 text-sm">لا يوجد استشاريين بعد. أضف استشاري جديد من الحقل أعلاه.</p>
            )}
          </div>
        </div>

        {/* بطاقات الاستشاريين التفصيلية */}
        <div className="space-y-5">
          {consultants.map((consultant: any) => {
            const detail = getDetail(consultant.id);
            const isEditing = editingId === consultant.id;

            return (
              <div key={consultant.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Consultant Header */}
                <div className="bg-gradient-to-l from-violet-50 to-white p-5 border-b border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {consultant.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-stone-800">{consultant.name}</h3>
                      {consultant.phone && (
                        <p className="text-sm text-stone-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {consultant.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => startEdit(consultant.id)} className="gap-1">
                      <Edit3 className="w-4 h-4" /> تعديل
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(consultant.id)} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <Save className="w-4 h-4" /> حفظ
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="gap-1">
                        <X className="w-4 h-4" /> إلغاء
                      </Button>
                    </div>
                  )}
                </div>

                {/* Details Grid */}
                <div className="p-5">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">هاتف إضافي</label>
                        <Input value={editData.phone2} onChange={(e) => setEditData({ ...editData, phone2: e.target.value })} placeholder="هاتف إضافي" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">الموقع</label>
                        <Input value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} placeholder="الموقع / العنوان" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">التصنيف</label>
                        <Input value={editData.classification} onChange={(e) => setEditData({ ...editData, classification: e.target.value })} placeholder="تصنيف المكتب" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">الوزن</label>
                        <Input value={editData.weight} onChange={(e) => setEditData({ ...editData, weight: e.target.value })} placeholder="وزن المكتب" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">سنوات الخبرة</label>
                        <Input type="number" value={editData.yearsOfExperience} onChange={(e) => setEditData({ ...editData, yearsOfExperience: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">عدد المهندسين</label>
                        <Input type="number" value={editData.numberOfEngineers} onChange={(e) => setEditData({ ...editData, numberOfEngineers: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">مسؤول التواصل</label>
                        <Input value={editData.contactPerson} onChange={(e) => setEditData({ ...editData, contactPerson: e.target.value })} placeholder="اسم مسؤول التواصل" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">هاتف مسؤول التواصل</label>
                        <Input value={editData.contactPersonPhone} onChange={(e) => setEditData({ ...editData, contactPersonPhone: e.target.value })} placeholder="هاتف مسؤول التواصل" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">بريد مسؤول التواصل</label>
                        <Input value={editData.contactPersonEmail} onChange={(e) => setEditData({ ...editData, contactPersonEmail: e.target.value })} placeholder="البريد الإلكتروني" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-stone-500 mb-1 block">عملاء بارزون</label>
                        <Textarea value={editData.notableClients} onChange={(e) => setEditData({ ...editData, notableClients: e.target.value })} placeholder="أسماء عملاء بارزين (كل عميل في سطر)" rows={3} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <InfoItem icon={<Phone className="w-4 h-4" />} label="هاتف إضافي" value={detail?.phone2} />
                      <InfoItem icon={<MapPin className="w-4 h-4" />} label="الموقع" value={detail?.location} />
                      <InfoItem icon={<Award className="w-4 h-4" />} label="التصنيف" value={detail?.classification} />
                      <InfoItem icon={<Hash className="w-4 h-4" />} label="الوزن" value={detail?.weight} />
                      <InfoItem icon={<Briefcase className="w-4 h-4" />} label="سنوات الخبرة" value={detail?.yearsOfExperience ? `${detail.yearsOfExperience} سنة` : undefined} />
                      <InfoItem icon={<Users className="w-4 h-4" />} label="عدد المهندسين" value={detail?.numberOfEngineers ? `${detail.numberOfEngineers} مهندس` : undefined} />
                      <InfoItem icon={<UserCircle className="w-4 h-4" />} label="مسؤول التواصل" value={detail?.contactPerson} />
                      <InfoItem icon={<Phone className="w-4 h-4" />} label="هاتف المسؤول" value={detail?.contactPersonPhone} />
                      <InfoItem icon={<Mail className="w-4 h-4" />} label="بريد المسؤول" value={detail?.contactPersonEmail} />
                      {detail?.notableClients && (
                        <div className="md:col-span-2 lg:col-span-3">
                          <InfoItem icon={<Building className="w-4 h-4" />} label="عملاء بارزون" value={detail.notableClients} />
                        </div>
                      )}
                    </div>
                  )}
                  {!detail && !isEditing && (
                    <div className="text-center py-6 text-stone-400">
                      <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">لم يتم إضافة معلومات تفصيلية بعد</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => startEdit(consultant.id)}>
                        إضافة معلومات
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return (
    <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
      <div className="flex items-center gap-2 text-stone-400 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm text-stone-300">—</p>
    </div>
  );
  return (
    <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
      <div className="flex items-center gap-2 text-stone-500 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm text-stone-800 font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}
