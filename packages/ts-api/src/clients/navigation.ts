import type { IpcTransport } from "../types";
import type {
  NavigationAddFavoriteRequest,
  NavigationFavoriteResponse,
  NavigationIsStarredRequest,
  NavigationIsStarredResponse,
  NavigationListFavoritesResponse,
  NavigationListRecentRequest,
  NavigationListRecentResponse,
  NavigationListStarredResponse,
  NavigationRecordVisitRequest,
  NavigationRemoveFavoriteRequest,
  NavigationRemoveRecentRequest,
  NavigationRenameFavoriteRequest,
  NavigationToggleStarredRequest,
  NavigationToggleStarredResponse,
  OkResponse,
} from "../generated/ipc";

export class NavigationClient {
  constructor(private readonly transport: IpcTransport) {}

  async recordVisit(
    request: NavigationRecordVisitRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("navigation.recordVisit", { request });
  }

  async listFavorites(): Promise<NavigationListFavoritesResponse> {
    return this.transport.invoke("navigation.listFavorites");
  }

  async addFavorite(
    request: NavigationAddFavoriteRequest,
  ): Promise<NavigationFavoriteResponse> {
    return this.transport.invoke("navigation.addFavorite", { request });
  }

  async removeFavorite(
    request: NavigationRemoveFavoriteRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("navigation.removeFavorite", {
      request,
    });
  }

  async renameFavorite(
    request: NavigationRenameFavoriteRequest,
  ): Promise<NavigationFavoriteResponse> {
    return this.transport.invoke("navigation.renameFavorite", {
      request,
    });
  }

  async listRecent(
    request: NavigationListRecentRequest,
  ): Promise<NavigationListRecentResponse> {
    return this.transport.invoke("navigation.listRecent", { request });
  }

  async clearRecent(): Promise<OkResponse> {
    return this.transport.invoke("navigation.clearRecent");
  }

  async removeRecent(
    request: NavigationRemoveRecentRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("navigation.removeRecent", {
      request,
    });
  }

  async listStarred(): Promise<NavigationListStarredResponse> {
    return this.transport.invoke("navigation.listStarred");
  }

  async toggleStarred(
    request: NavigationToggleStarredRequest,
  ): Promise<NavigationToggleStarredResponse> {
    return this.transport.invoke("navigation.toggleStarred", {
      request,
    });
  }

  async isStarred(
    request: NavigationIsStarredRequest,
  ): Promise<NavigationIsStarredResponse> {
    return this.transport.invoke("navigation.isStarred", { request });
  }
}
