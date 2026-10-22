#include "pathfinding.hpp"
#include <queue>
#include <unordered_map>
#include <algorithm>
#include <cstdlib>

namespace b2d {

bool Grid::isBlocked(int x,int y) const {
  if (x<0||y<0||x>=width||y>=height) return true;
  return blocked[y*width+x]!=0;
}

int manhattan(Vec2i a, Vec2i b){ return std::abs(a.x-b.x)+std::abs(a.y-b.y); }

struct Node { Vec2i pos; int g; int f; };
struct Cmp { bool operator()(const Node& a,const Node& b) const { return a.f>b.f; } };

std::vector<Vec2i> findPathAStar(const Grid& grid, Vec2i start, Vec2i goal){
  if (grid.isBlocked(start.x,start.y) || grid.isBlocked(goal.x,goal.y)) return {};
  std::priority_queue<Node, std::vector<Node>, Cmp> open;
  std::unordered_map<int,int> gScore;
  std::unordered_map<int,Vec2i> cameFrom;
  auto key=[&](Vec2i p){ return p.y*grid.width+p.x; };
  open.push({start,0,manhattan(start,goal)});
  gScore[key(start)]=0;
  const int dirs[4][2]={{1,0},{-1,0},{0,1},{0,-1}};
  while(!open.empty()){
    auto cur=open.top(); open.pop();
    if (cur.pos==goal){
      std::vector<Vec2i> path; Vec2i c=goal;
      while(!(c==start)){ path.push_back(c); auto it=cameFrom.find(key(c)); if(it==cameFrom.end()) break; c=it->second; }
      path.push_back(start); std::reverse(path.begin(),path.end()); return path;
    }
    for(auto d:dirs){
      Vec2i nb{cur.pos.x+d[0],cur.pos.y+d[1]};
      if (grid.isBlocked(nb.x,nb.y)) continue;
      int tentative=cur.g+1;
      int k=key(nb);
      auto it=gScore.find(k);
      if(it==gScore.end()||tentative<it->second){
        gScore[k]=tentative;
        cameFrom[k]=cur.pos;
        open.push({nb,tentative,tentative+manhattan(nb,goal)});
      }
    }
  }
  return {};
}

}
