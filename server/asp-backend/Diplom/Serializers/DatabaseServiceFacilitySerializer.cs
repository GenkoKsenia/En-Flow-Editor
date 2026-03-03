namespace Diplom.Serializers
{
    public class DatabaseServiceFacilitySerializer: IServiceFacilitySerializer
    {
        private JsonContent json;
        public DatabaseServiceFacilitySerializer(JsonContent _json) 
        { 
            json = _json;
        }
        public string Serialize(object obj)
        {
            return "code";
        }
    }
}