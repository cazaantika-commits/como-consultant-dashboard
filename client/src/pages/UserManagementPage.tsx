import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOwner } from "@/contexts/OwnerContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Users, Shield, User, Clock } from "lucide-react";
import { toast } from "sonner";

export default function UserManagementPage() {
  const { isOwner } = useOwner();
  const [, navigate] = useLocation();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data: usersList, isLoading, refetch } = trpc.userManagement.listUsers.useQuery(undefined, {
    enabled: isOwner,
  });

  const setRole = trpc.userManagement.setRole.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية بنجاح");
      refetch();
      setLoadingId(null);
    },
    onError: () => {
      toast.error("فشل تحديث الصلاحية");
      setLoadingId(null);
    },
  });

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">غير مصرح بالوصول</p>
      </div>
    );
  }

  const handleToggleRole = (userId: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setLoadingId(userId);
    setRole.mutate({ userId, role: newRole });
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
            <p className="text-sm text-muted-foreground">تحكم في صلاحيات الوصول للمنصة</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">مدير</Badge>
              <span className="text-muted-foreground">صلاحية كاملة — تعديل وإعدادات</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-muted-foreground">مستخدم</Badge>
              <span className="text-muted-foreground">اطلاع كامل + مركز القيادة — بدون تعديل</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">المستخدمون المسجلون</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جارٍ التحميل...</div>
          ) : !usersList?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              لا يوجد مستخدمون مسجلون بعد. عندما يسجل وائل والشيخ عيسى دخولهم سيظهرون هنا.
            </div>
          ) : (
            <div className="space-y-2">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      {u.role === "admin" ? (
                        <Shield className="h-4 w-4 text-amber-400" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{u.name || "مستخدم غير مسمى"}</p>
                      <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {u.lastSignedIn
                          ? new Date(u.lastSignedIn).toLocaleDateString("ar-AE")
                          : "—"}
                      </span>
                    </div>

                    <Badge
                      className={
                        u.role === "admin"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }
                    >
                      {u.role === "admin" ? "مدير" : "مستخدم"}
                    </Badge>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingId === u.id}
                      onClick={() => handleToggleRole(u.id, u.role)}
                      className="text-xs"
                    >
                      {loadingId === u.id
                        ? "..."
                        : u.role === "admin"
                        ? "تحويل لمستخدم"
                        : "ترقية لمدير"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
