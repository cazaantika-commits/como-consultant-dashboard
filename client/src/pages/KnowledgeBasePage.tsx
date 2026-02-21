import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Lightbulb, TrendingUp, Award, GraduationCap, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const typeIcons: Record<string, any> = {
  decision: Award,
  evaluation: BookOpen,
  pattern: TrendingUp,
  insight: Lightbulb,
  lesson: GraduationCap,
};

const typeColors: Record<string, string> = {
  decision: "bg-blue-500",
  evaluation: "bg-green-500",
  pattern: "bg-purple-500",
  insight: "bg-yellow-500",
  lesson: "bg-orange-500",
};

const typeLabels: Record<string, string> = {
  decision: "قرار",
  evaluation: "تقييم",
  pattern: "نمط",
  insight: "رؤية",
  lesson: "درس مستفاد",
};

const importanceColors: Record<string, string> = {
  low: "bg-gray-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const importanceLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

export default function KnowledgeBasePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data: allItems, isLoading } = trpc.knowledge.list.useQuery({});
  const { data: searchResults } = trpc.knowledge.search.useQuery(
    { searchTerm, limit: 50 },
    { enabled: searchTerm.length > 2 }
  );

  const displayItems = searchTerm.length > 2 ? searchResults : allItems;
  const filteredItems = selectedType === "all" 
    ? displayItems 
    : displayItems?.filter(item => item.type === selectedType);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">قاعدة المعرفة المؤسسية</h1>
        <p className="text-muted-foreground">
          الذاكرة المؤسسية - القرارات، التقييمات، الأنماط، والدروس المستفادة
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث في قاعدة المعرفة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      {/* Type Filters */}
      <Tabs value={selectedType} onValueChange={setSelectedType} className="mb-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="decision">قرارات</TabsTrigger>
          <TabsTrigger value="evaluation">تقييمات</TabsTrigger>
          <TabsTrigger value="pattern">أنماط</TabsTrigger>
          <TabsTrigger value="insight">رؤى</TabsTrigger>
          <TabsTrigger value="lesson">دروس</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          )}
          
          {!isLoading && filteredItems && filteredItems.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                لا توجد نتائج
              </CardContent>
            </Card>
          )}

          {filteredItems?.map((item: any) => {
            const Icon = typeIcons[item.type] || BookOpen;
            return (
              <Card 
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedItem(item)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${typeColors[item.type]}`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <Badge variant="outline">{typeLabels[item.type]}</Badge>
                        <Badge className={importanceColors[item.importance]}>
                          {importanceLabels[item.importance]}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {item.summary || item.content.substring(0, 150) + "..."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {item.sourceAgent && (
                        <span>الوكيل: {item.sourceAgent}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {item.viewCount || 0}
                      </span>
                    </div>
                    <span>{new Date(item.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detail View */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          {selectedItem ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-3">
                  {(() => {
                    const Icon = typeIcons[selectedItem.type] || BookOpen;
                    return (
                      <div className={`p-2 rounded-lg ${typeColors[selectedItem.type]}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    );
                  })()}
                  <Badge variant="outline">{typeLabels[selectedItem.type]}</Badge>
                  <Badge className={importanceColors[selectedItem.importance]}>
                    {importanceLabels[selectedItem.importance]}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{selectedItem.title}</CardTitle>
                <CardDescription>
                  {selectedItem.sourceAgent && `الوكيل: ${selectedItem.sourceAgent} • `}
                  {new Date(selectedItem.createdAt).toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedItem.summary && (
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">الملخص</h3>
                    <p className="text-sm">{selectedItem.summary}</p>
                  </div>
                )}
                <div className="prose prose-sm max-w-none">
                  <h3 className="font-semibold mb-2">التفاصيل</h3>
                  <p className="whitespace-pre-wrap">{selectedItem.content}</p>
                </div>
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2 text-sm">الوسوم</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  تم العرض {selectedItem.viewCount || 0} مرة
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>اختر عنصراً لعرض التفاصيل</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
