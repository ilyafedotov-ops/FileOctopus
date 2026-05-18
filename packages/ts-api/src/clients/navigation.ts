import type {
  IpcTransport,
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
  NavigationRenameFavoriteRequest,
  NavigationToggleStarredRequest,
  NavigationToggleStarredResponse,
  OkResponse,
} from "../types";
import { normalizeIpcError } from "../normalizeError";

export class NavigationClient {
  constructor(private readonly transport: IpcTransport) {}

  async recordVisit(
    request: NavigationRecordVisitRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("navigation.recordVisit", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listFavorites(): Promise<NavigationListFavoritesResponse> {
    try {
      return await this.transport.invoke("navigation.listFavorites");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async addFavorite(
    request: NavigationAddFavoriteRequest,
  ): Promise<NavigationFavoriteResponse> {
    try {
      return await this.transport.invoke("navigation.addFavorite", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async removeFavorite(
    request: NavigationRemoveFavoriteRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("navigation.removeFavorite", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async renameFavorite(
    request: NavigationRenameFavoriteRequest,
  ): Promise<NavigationFavoriteResponse> {
    try {
      return await this.transport.invoke("navigation.renameFavorite", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listRecent(
    request: NavigationListRecentRequest,
  ): Promise<NavigationListRecentResponse> {
    try {
      return await this.transport.invoke("navigation.listRecent", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async clearRecent(): Promise<OkResponse> {
    try {
      return await this.transport.invoke("navigation.clearRecent");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async removeRecent(
    request: import("../types").NavigationRemoveRecentRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("navigation.removeRecent", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listStarred(): Promise<NavigationListStarredResponse> {
    try {
      return await this.transport.invoke("navigation.listStarred");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async toggleStarred(
    request: NavigationToggleStarredRequest,
  ): Promise<NavigationToggleStarredResponse> {
    try {
      return await this.transport.invoke("navigation.toggleStarred", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async isStarred(
    request: NavigationIsStarredRequest,
  ): Promise<NavigationIsStarredResponse> {
    try {
      return await this.transport.invoke("navigation.isStarred", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
