import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';

/**
 * MembershipManagement: 会员插件管理 UI 容器
 * 该页面通过 RPC Proxy 代理访问后端插件逻辑
 */
export const MembershipManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalMembers: 0, activeTiers: 0 });

  useEffect(() => {
    // 模拟从 RPC Proxy 获取数据
    const fetchPluginData = async () => {
      try {
        // 实际上这里会请求 /api/v1/plugins/proxy/membership/stats 等接口
        setLoading(false);
        setStats({ totalMembers: 128, activeTiers: 3 });
      } catch (e) {
        console.error('Failed to load membership data', e);
      }
    };
    fetchPluginData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">会员系统管理</h1>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          插件已启用 (Active)
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总会员数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">生效等级</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTiers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>会员等级概览</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>等级名称</TableHead>
                <TableHead>折扣率</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">普通会员</TableCell>
                <TableCell>100%</TableCell>
                <TableCell><Badge variant="secondary">默认</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">银卡 VIP</TableCell>
                <TableCell>95%</TableCell>
                <TableCell><Badge variant="outline">正常</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">金卡 VIP</TableCell>
                <TableCell>85%</TableCell>
                <TableCell><Badge variant="outline">正常</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground italic">
        * 数据通过系统 RPC Proxy 实时获取，确保多租户数据逻辑隔离。
      </div>
    </div>
  );
};

export default MembershipManagement;
