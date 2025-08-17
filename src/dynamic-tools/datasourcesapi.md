## Data Sources - Create Or Update

Creates a new datasource or updates a datasource if it already exists.

```
PUT {endpoint}/datasources('{dataSourceName}')?api-version=2025-05-01-preview
```

```
PUT {endpoint}/datasources('{dataSourceName}')?api-version=2025-05-01-preview&ignoreResetRequirements={ignoreResetRequirements}
```

## URI Parameters

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| data  Source  Name | path | True | string | The name of the datasource to create or update. |
| endpoint | path | True | string | The endpoint URL of the search service. |
| api-version | query | True | string | Client Api Version. |
| ignore  Reset  Requirements | query |  | boolean | Ignores cache reset requirements. |

## Request Header

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| x-ms-client-request-id |  | string (uuid) | The tracking ID sent with the request to help with debugging. |
| If-Match |  | string | Defines the If-Match condition. The operation will be performed only if the ETag on the server matches this value. |
| If-None-Match |  | string | Defines the If-None-Match condition. The operation will be performed only if the ETag on the server does not match this value. |
| Prefer | True | string | For HTTP PUT requests, instructs the service to return the created/updated resource on success. |

## Request Body

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| container | True | [Search  Indexer  Data  Container](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatacontainer) | The data container for the datasource. |
| credentials | True | [Data  Source  Credentials](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#datasourcecredentials) | Credentials for the datasource. |
| name | True | string | The name of the datasource. |
| type | True | [Search  Indexer  Data  Source  Type](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatasourcetype) | The type of the datasource. |
| @odata.etag |  | string | The ETag of the data source. |
| dataChangeDetectionPolicy |  | DataChangeDetectionPolicy: - [High  Water  Mark  Change  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#highwatermarkchangedetectionpolicy) - [Sql  Integrated  Change  Tracking  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#sqlintegratedchangetrackingpolicy) | The data change detection policy for the datasource. |
| dataDeletionDetectionPolicy |  | DataDeletionDetectionPolicy: - [Soft  Delete  Column  Deletion  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#softdeletecolumndeletiondetectionpolicy) - [Native  Blob  Soft  Delete  Deletion  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#nativeblobsoftdeletedeletiondetectionpolicy) | The data deletion detection policy for the datasource. |
| description |  | string | The description of the datasource. |
| encryptionKey |  | [Search  Resource  Encryption  Key](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchresourceencryptionkey) | A description of an encryption key that you create in Azure Key Vault. This key is used to provide an additional level of encryption-at-rest for your datasource definition when you want full assurance that no one, not even Microsoft, can decrypt your data source definition. Once you have encrypted your data source definition, it will always remain encrypted. The search service will ignore attempts to set this property to null. You can change this property as needed if you want to rotate your encryption key; Your datasource definition will be unaffected. Encryption with customer-managed keys is not available for free search services, and is only available for paid services created on or after January 1, 2019. |
| identity |  | SearchIndexerDataIdentity: - [Search  Indexer  Data  None  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatanoneidentity) - [Search  Indexer  Data  User  Assigned  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatauserassignedidentity) | An explicit managed identity to use for this datasource. If not specified and the connection string is a managed identity, the system-assigned managed identity is used. If not specified, the value remains unchanged. If "none" is specified, the value of this property is cleared. |
| indexerPermissionOptions |  | [Indexer  Permission  Option](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#indexerpermissionoption) \[\] | Ingestion options with various types of permission data. |

## Responses

| Name | Type | Description |
| --- | --- | --- |
| 200 OK | [Search  Indexer  Data  Source](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatasource) |  |
| 201 Created | [Search  Indexer  Data  Source](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatasource) |  |
| Other Status Codes | [Error  Response](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#errorresponse) | Error response. |

## Examples

### SearchServiceCreateOrUpdateDataSource

#### Sample request

- [HTTP](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#tabpanel_1_HTTP)

```
PUT https://previewexampleservice.search.windows.net/datasources('tempdatasource')?api-version=2025-05-01-preview&ignoreResetRequirements=

{
  "name": "tempdatasource",
  "description": "My Azure Adls Gen2 data source with ACLs.",
  "type": "adlsgen2",
  "credentials": {
    "connectionString": "DefaultEndpointsProtocol=https;AccountName=myAccountName;AccountKey=myAccountKey;EndpointSuffix=core.windows.net "
  },
  "container": {
    "name": "adls-gen2-doc-extraction-acl",
    "query": "folder_has_final_acl"
  },
  "identity": {
    "@odata.type": "#Microsoft.Azure.Search.DataNoneIdentity"
  },
  "indexerPermissionOptions": [
    "userIds",
    "groupIds",
    "rbacScope"
  ],
  "dataChangeDetectionPolicy": {
    "highWaterMarkColumnName": "metadata_storage_last_modified",
    "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy"
  },
  "dataDeletionDetectionPolicy": {
    "softDeleteColumnName": "isDeleted",
    "softDeleteMarkerValue": "true",
    "@odata.type": "#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy"
  },
  "@odata.etag": "0x1234568AE7E58A1",
  "encryptionKey": {
    "keyVaultKeyName": "myUserManagedEncryptionKey-createdinAzureKeyVault",
    "keyVaultKeyVersion": "myKeyVersion-32charAlphaNumericString",
    "keyVaultUri": "https://myKeyVault.vault.azure.net",
    "accessCredentials": {
      "applicationId": "00000000-0000-0000-0000-000000000000",
      "applicationSecret": "<applicationSecret>"
    }
  }
}
```

#### Sample response

```json
{
  "@odata.etag": "0x1234568AE7E58A1",
  "name": "tempdatasource",
  "description": "My Azure Adls Gen2 data source with ACLs.",
  "type": "adlsgen2",
  "indexerPermissionOptions": [
    "userIds",
    "groupIds",
    "rbacScope"
  ],
  "credentials": {
    "connectionString": "DefaultEndpointsProtocol=https;AccountName=myAccountName;AccountKey=myAccountKey;EndpointSuffix=core.windows.net "
  },
  "container": {
    "name": "adls-gen2-doc-extraction-acl",
    "query": "folder_has_final_acl"
  },
  "dataChangeDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
    "highWaterMarkColumnName": "metadata_storage_last_modified"
  },
  "dataDeletionDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy",
    "softDeleteColumnName": "isDeleted",
    "softDeleteMarkerValue": "true"
  },
  "encryptionKey": {
    "keyVaultKeyName": "myUserManagedEncryptionKey-createdinAzureKeyVault",
    "keyVaultKeyVersion": "myKeyVersion-32charAlphaNumericString",
    "keyVaultUri": "https://myKeyVault.vault.azure.net",
    "accessCredentials": {
      "applicationId": "00000000-0000-0000-0000-000000000000",
      "applicationSecret": "<applicationSecret>"
    }
  },
  "identity": {
    "@odata.type": "#Microsoft.Azure.Search.DataNoneIdentity"
  }
}
```
```json
{
  "@odata.etag": "0x1234568AE7E58A1",
  "name": "tempdatasource",
  "description": "My Azure Adls Gen2 data source with ACLs.",
  "type": "adlsgen2",
  "indexerPermissionOptions": [
    "userIds",
    "groupIds",
    "rbacScope"
  ],
  "credentials": {
    "connectionString": "DefaultEndpointsProtocol=https;AccountName=myAccountName;AccountKey=myAccountKey;EndpointSuffix=core.windows.net "
  },
  "container": {
    "name": "adls-gen2-doc-extraction-acl",
    "query": "folder_has_final_acl"
  },
  "dataChangeDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
    "highWaterMarkColumnName": "metadata_storage_last_modified"
  },
  "dataDeletionDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy",
    "softDeleteColumnName": "isDeleted",
    "softDeleteMarkerValue": "true"
  },
  "encryptionKey": {
    "keyVaultKeyName": "myUserManagedEncryptionKey-createdinAzureKeyVault",
    "keyVaultKeyVersion": "myKeyVersion-32charAlphaNumericString",
    "keyVaultUri": "https://myKeyVault.vault.azure.net",
    "accessCredentials": {
      "applicationId": "00000000-0000-0000-0000-000000000000",
      "applicationSecret": "<applicationSecret>"
    }
  },
  "identity": {
    "@odata.type": "#Microsoft.Azure.Search.DataNoneIdentity"
  }
}
```

## Definitions

| Name | Description |
| --- | --- |
| [Azure  Active  Directory  Application  Credentials](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#azureactivedirectoryapplicationcredentials) | Credentials of a registered application created for your search service, used for authenticated access to the encryption keys stored in Azure Key Vault. |
| [Data  Source  Credentials](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#datasourcecredentials) | Represents credentials that can be used to connect to a datasource. |
| [Error  Additional  Info](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#erroradditionalinfo) | The resource management error additional info. |
| [Error  Detail](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#errordetail) | The error detail. |
| [Error  Response](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#errorresponse) | Error response |
| [High  Water  Mark  Change  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#highwatermarkchangedetectionpolicy) | Defines a data change detection policy that captures changes based on the value of a high water mark column. |
| [Indexer  Permission  Option](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#indexerpermissionoption) | Options with various types of permission data to index. |
| [Native  Blob  Soft  Delete  Deletion  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#nativeblobsoftdeletedeletiondetectionpolicy) | Defines a data deletion detection policy utilizing Azure Blob Storage's native soft delete feature for deletion detection. |
| [Search  Indexer  Data  Container](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatacontainer) | Represents information about the entity (such as Azure SQL table or CosmosDB collection) that will be indexed. |
| [Search  Indexer  Data  None  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatanoneidentity) | Clears the identity property of a datasource. |
| [Search  Indexer  Data  Source](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatasource) | Represents a datasource definition, which can be used to configure an indexer. |
| [Search  Indexer  Data  Source  Type](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatasourcetype) | Defines the type of a datasource. |
| [Search  Indexer  Data  User  Assigned  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatauserassignedidentity) | Specifies the identity for a datasource to use. |
| [Search  Resource  Encryption  Key](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchresourceencryptionkey) | A customer-managed encryption key in Azure Key Vault. Keys that you create and manage can be used to encrypt or decrypt data-at-rest, such as indexes and synonym maps. |
| [Soft  Delete  Column  Deletion  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#softdeletecolumndeletiondetectionpolicy) | Defines a data deletion detection policy that implements a soft-deletion strategy. It determines whether an item should be deleted based on the value of a designated 'soft delete' column. |
| [Sql  Integrated  Change  Tracking  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#sqlintegratedchangetrackingpolicy) | Defines a data change detection policy that captures changes using the Integrated Change Tracking feature of Azure SQL Database. |

### AzureActiveDirectoryApplicationCredentials

Credentials of a registered application created for your search service, used for authenticated access to the encryption keys stored in Azure Key Vault.

| Name | Type | Description |
| --- | --- | --- |
| applicationId | string | An AAD Application ID that was granted the required access permissions to the Azure Key Vault that is to be used when encrypting your data at rest. The Application ID should not be confused with the Object ID for your AAD Application. |
| applicationSecret | string | The authentication key of the specified AAD application. |

### DataSourceCredentials

Represents credentials that can be used to connect to a datasource.

| Name | Type | Description |
| --- | --- | --- |
| connectionString | string | The connection string for the datasource. Set to `<unchanged>` (with brackets) if you don't want the connection string updated. Set to `<redacted>` if you want to remove the connection string value from the datasource. |

### ErrorAdditionalInfo

The resource management error additional info.

| Name | Type | Description |
| --- | --- | --- |
| info | object | The additional info. |
| type | string | The additional info type. |

### ErrorDetail

The error detail.

| Name | Type | Description |
| --- | --- | --- |
| additionalInfo | [Error  Additional  Info](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#erroradditionalinfo) \[\] | The error additional info. |
| code | string | The error code. |
| details | [Error  Detail](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#errordetail) \[\] | The error details. |
| message | string | The error message. |
| target | string | The error target. |

### ErrorResponse

Error response

| Name | Type | Description |
| --- | --- | --- |
| error | [Error  Detail](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#errordetail) | The error object. |

### HighWaterMarkChangeDetectionPolicy

Defines a data change detection policy that captures changes based on the value of a high water mark column.

| Name | Type | Description |
| --- | --- | --- |
| @odata.type | string:  #Microsoft. Azure. Search. High  Water  Mark  Change  Detection  Policy | A URI fragment specifying the type of data change detection policy. |
| highWaterMarkColumnName | string | The name of the high water mark column. |

### IndexerPermissionOption

Options with various types of permission data to index.

| Value | Description |
| --- | --- |
| userIds | Indexer to ingest ACL userIds from data source to index. |
| groupIds | Indexer to ingest ACL groupIds from data source to index. |
| rbacScope | Indexer to ingest Azure RBAC scope from data source to index. |

### NativeBlobSoftDeleteDeletionDetectionPolicy

Defines a data deletion detection policy utilizing Azure Blob Storage's native soft delete feature for deletion detection.

| Name | Type | Description |
| --- | --- | --- |
| @odata.type | string:  #Microsoft. Azure. Search. Native  Blob  Soft  Delete  Deletion  Detection  Policy | A URI fragment specifying the type of data deletion detection policy. |

### SearchIndexerDataContainer

Represents information about the entity (such as Azure SQL table or CosmosDB collection) that will be indexed.

| Name | Type | Description |
| --- | --- | --- |
| name | string | The name of the table or view (for Azure SQL data source) or collection (for CosmosDB data source) that will be indexed. |
| query | string | A query that is applied to this data container. The syntax and meaning of this parameter is datasource-specific. Not supported by Azure SQL datasources. |

### SearchIndexerDataNoneIdentity

Clears the identity property of a datasource.

| Name | Type | Description |
| --- | --- | --- |
| @odata.type | string:  #Microsoft. Azure. Search. Data  None  Identity | A URI fragment specifying the type of identity. |

### SearchIndexerDataSource

Represents a datasource definition, which can be used to configure an indexer.

| Name | Type | Description |
| --- | --- | --- |
| @odata.etag | string | The ETag of the data source. |
| container | [Search  Indexer  Data  Container](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatacontainer) | The data container for the datasource. |
| credentials | [Data  Source  Credentials](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#datasourcecredentials) | Credentials for the datasource. |
| dataChangeDetectionPolicy | DataChangeDetectionPolicy: - [High  Water  Mark  Change  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#highwatermarkchangedetectionpolicy) - [Sql  Integrated  Change  Tracking  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#sqlintegratedchangetrackingpolicy) | The data change detection policy for the datasource. |
| dataDeletionDetectionPolicy | DataDeletionDetectionPolicy: - [Native  Blob  Soft  Delete  Deletion  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#nativeblobsoftdeletedeletiondetectionpolicy) - [Soft  Delete  Column  Deletion  Detection  Policy](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#softdeletecolumndeletiondetectionpolicy) | The data deletion detection policy for the datasource. |
| description | string | The description of the datasource. |
| encryptionKey | [Search  Resource  Encryption  Key](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchresourceencryptionkey) | A description of an encryption key that you create in Azure Key Vault. This key is used to provide an additional level of encryption-at-rest for your datasource definition when you want full assurance that no one, not even Microsoft, can decrypt your data source definition. Once you have encrypted your data source definition, it will always remain encrypted. The search service will ignore attempts to set this property to null. You can change this property as needed if you want to rotate your encryption key; Your datasource definition will be unaffected. Encryption with customer-managed keys is not available for free search services, and is only available for paid services created on or after January 1, 2019. |
| identity | SearchIndexerDataIdentity: - [Search  Indexer  Data  None  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatanoneidentity) - [Search  Indexer  Data  User  Assigned  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatauserassignedidentity) | An explicit managed identity to use for this datasource. If not specified and the connection string is a managed identity, the system-assigned managed identity is used. If not specified, the value remains unchanged. If "none" is specified, the value of this property is cleared. |
| indexerPermissionOptions | [Indexer  Permission  Option](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#indexerpermissionoption) \[\] | Ingestion options with various types of permission data. |
| name | string | The name of the datasource. |
| type | [Search  Indexer  Data  Source  Type](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatasourcetype) | The type of the datasource. |

### SearchIndexerDataSourceType

Defines the type of a datasource.

| Value | Description |
| --- | --- |
| azuresql | Indicates an Azure SQL datasource. |
| cosmosdb | Indicates a CosmosDB datasource. |
| azureblob | Indicates an Azure Blob datasource. |
| azuretable | Indicates an Azure Table datasource. |
| mysql | Indicates a MySql datasource. |
| adlsgen2 | Indicates an ADLS Gen2 datasource. |
| onelake | Indicates a Microsoft Fabric OneLake datasource. |

### SearchIndexerDataUserAssignedIdentity

Specifies the identity for a datasource to use.

| Name | Type | Description |
| --- | --- | --- |
| @odata.type | string:  #Microsoft. Azure. Search. Data  User  Assigned  Identity | A URI fragment specifying the type of identity. |
| userAssignedIdentity | string | The fully qualified Azure resource Id of a user assigned managed identity typically in the form "/subscriptions/12345678-1234-1234-1234-1234567890ab/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/myId" that should have been assigned to the search service. |

### SearchResourceEncryptionKey

A customer-managed encryption key in Azure Key Vault. Keys that you create and manage can be used to encrypt or decrypt data-at-rest, such as indexes and synonym maps.

| Name | Type | Description |
| --- | --- | --- |
| accessCredentials | [Azure  Active  Directory  Application  Credentials](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#azureactivedirectoryapplicationcredentials) | Optional Azure Active Directory credentials used for accessing your Azure Key Vault. Not required if using managed identity instead. |
| identity | SearchIndexerDataIdentity: - [Search  Indexer  Data  None  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatanoneidentity) - [Search  Indexer  Data  User  Assigned  Identity](https://learn.microsoft.com/en-us/rest/api/searchservice/data-sources/?view=rest-searchservice-2025-05-01-preview&tabs=HTTP#searchindexerdatauserassignedidentity) | An explicit managed identity to use for this encryption key. If not specified and the access credentials property is null, the system-assigned managed identity is used. On update to the resource, if the explicit identity is unspecified, it remains unchanged. If "none" is specified, the value of this property is cleared. |
| keyVaultKeyName | string | The name of your Azure Key Vault key to be used to encrypt your data at rest. |
| keyVaultKeyVersion | string | The version of your Azure Key Vault key to be used to encrypt your data at rest. |
| keyVaultUri | string | The URI of your Azure Key Vault, also referred to as DNS name, that contains the key to be used to encrypt your data at rest. An example URI might be `https://my-keyvault-name.vault.azure.net`. |

### SoftDeleteColumnDeletionDetectionPolicy

Defines a data deletion detection policy that implements a soft-deletion strategy. It determines whether an item should be deleted based on the value of a designated 'soft delete' column.

| Name | Type | Description |
| --- | --- | --- |
| @odata.type | string:  #Microsoft. Azure. Search. Soft  Delete  Column  Deletion  Detection  Policy | A URI fragment specifying the type of data deletion detection policy. |
| softDeleteColumnName | string | The name of the column to use for soft-deletion detection. |
| softDeleteMarkerValue | string | The marker value that identifies an item as deleted. |

### SqlIntegratedChangeTrackingPolicy

Defines a data change detection policy that captures changes using the Integrated Change Tracking feature of Azure SQL Database.

| Name | Type | Description |
| --- | --- | --- |
| @odata.type | string:  #Microsoft. Azure. Search. Sql  Integrated  Change  Tracking  Policy | A URI fragment specifying the type of data change detection policy. |
