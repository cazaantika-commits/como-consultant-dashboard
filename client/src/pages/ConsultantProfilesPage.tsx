import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Building2, Globe, Users, Award, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function ConsultantProfilesPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { data: consultantsWithProfiles, isLoading } = trpc.profiles.listWithProfiles.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Card className="w-96 text-center">
          <CardContent className="pt-6">
            <p className="mb-4 text-gray-600">يرجى تسجيل الدخول للوصول إلى الملفات التعريفية</p>
            <a href={getLoginUrl()}>
              <Button>تسجيل الدخول</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-blue-700 to-blue-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">الملفات التعريفية للاستشاريين</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80">{user?.name}</span>
            <Link href="/">
              <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
                <ChevronLeft className="h-4 w-4 ml-1" />
                الرئيسية
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          </div>
        ) : !consultantsWithProfiles || consultantsWithProfiles.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">لا يوجد استشاريون حالياً</p>
              <p className="text-gray-400 text-sm mt-2">يمكنك إضافة استشاريين من صفحة تقييم الاستشاريين</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {consultantsWithProfiles.map((item) => (
              <Link key={item.id} href={`/consultant-profile/${item.id}`}>
                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-300 h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-blue-800">{item.name}</CardTitle>
                        {item.profile?.companyNameAr && (
                          <p className="text-sm text-gray-500 mt-1">{item.profile.companyNameAr}</p>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400 mt-1 rotate-180" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Specialization */}
                    {item.specialization && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Award className="h-4 w-4 text-amber-500" />
                        <span>{item.specialization}</span>
                      </div>
                    )}

                    {/* Profile info */}
                    {item.profile ? (
                      <div className="space-y-2">
                        {item.profile.headquarters && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span>{item.profile.headquarters}</span>
                          </div>
                        )}
                        {item.profile.website && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Globe className="h-4 w-4 text-gray-400" />
                            <span className="truncate">{item.profile.website}</span>
                          </div>
                        )}
                        {item.profile.employeeCount && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span>{item.profile.employeeCount} موظف</span>
                          </div>
                        )}
                        {item.profile.specializations && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.profile.specializations.split(",").slice(0, 3).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s.trim()}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                        <p className="text-amber-700 text-sm">لم يتم إضافة ملف تعريفي بعد</p>
                        <p className="text-amber-500 text-xs mt-1">اضغط لإضافة التفاصيل</p>
                      </div>
                    )}

                    {/* Contact */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
                      {item.email && <span>{item.email}</span>}
                      {item.phone && <span>{item.phone}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
